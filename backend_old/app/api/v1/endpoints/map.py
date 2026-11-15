from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import SessionLocal
from app.db.models import POP, Cable, Device
from typing import Optional
import json
import io
import zipfile
import re
from xml.sax.saxutils import escape

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from typing import Optional

@router.get("/topology")
@router.get("/topology/")
def get_map_topology(region: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns GeoJSON FeatureCollection of all PoPs (Points) and Cables (LineStrings)
    """
    features = []
    
    # 1. Fetch PoPs as Point Features
    pops = db.query(POP, func.ST_AsGeoJSON(POP.location).label("geojson")).all()
    for pop, geojson_str in pops:
        if not geojson_str:
            continue
            
        import json
        geometry = json.loads(geojson_str)
        
        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "id": str(pop.id),
                "name": pop.name,
                "type": "pop",
                "org_id": str(pop.org_id)
            }
        })
        
    # 2. Fetch Devices as Point Features
    devices_query = db.query(Device, func.ST_AsGeoJSON(Device.location).label("geojson")).filter(Device.location.is_not(None))
    if region and region != "All":
        devices_query = devices_query.filter(Device.region == region)
        
    devices = devices_query.all()
    for device, geojson_str in devices:
        if not geojson_str:
            continue
            
        import json
        geometry = json.loads(geojson_str)
        
        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "id": str(device.id),
                "name": device.name,
                "type": "device",
                "device_type": device.device_type,
                "pop_id": str(device.pop_id) if device.pop_id else None,
                "description": device.description,
                "capacity": device.capacity,
                "used_capacity": device.used_capacity,
                "icon_url": device.icon_url,
                "region": device.region
            }
        })

    # 3. Fetch Cables as LineString Features
    cables_query = db.query(Cable, func.ST_AsGeoJSON(Cable.route).label("geojson"))
    if region and region != "All":
        cables_query = cables_query.filter(Cable.region == region)
        
    cables = cables_query.all()
    for cable, geojson_str in cables:
        if not geojson_str:
            continue
            
        import json
        import math
        geometry = json.loads(geojson_str)
        
        # Calculate length dynamically if missing
        cable_len = cable.length
        if cable_len is None or cable_len <= 0:
            coords = geometry.get("coordinates", [])
            if len(coords) >= 2:
                R = 6371000
                total = 0.0
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i+1]
                    lat1, lon1 = math.radians(p1[1]), math.radians(p1[0])
                    lat2, lon2 = math.radians(p2[1]), math.radians(p2[0])
                    dlat = lat2 - lat1
                    dlon = lon2 - lon1
                    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
                    total += R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                cable_len = round(total, 2)
            else:
                cable_len = 0.0

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "id": str(cable.id),
                "name": cable.name,
                "type": "cable",
                "cable_type": cable.type,
                "capacity": cable.capacity,
                "region": cable.region,
                "description": cable.description,
                "color": cable.color,
                "length": cable_len,
                "line_width": getattr(cable, "line_width", 3.0) or 3.0
            }
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }

def build_kml_document(region: Optional[str], db: Session):
    safe_region = region if region and region != "All" else "All_Regions"
    safe_region_clean = re.sub(r'[^a-zA-Z0-9_\-]', '_', safe_region)
    
    # 1. Fetch devices
    dev_query = db.query(Device, func.ST_AsGeoJSON(Device.location).label("geojson")).filter(Device.location.is_not(None))
    if region and region != "All":
        dev_query = dev_query.filter(Device.region == region)
    devices = dev_query.all()
    
    # 2. Fetch cables
    cable_query = db.query(Cable, func.ST_AsGeoJSON(Cable.route).label("geojson")).filter(Cable.route.is_not(None))
    if region and region != "All":
        cable_query = cable_query.filter(Cable.region == region)
    cables = cable_query.all()
    
    # 3. Build KML
    kml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        '  <Document>',
        f'    <name>FiberCore - {escape(safe_region)}</name>',
        f'    <description>Exported from FiberCore Enterprise FTTH System for {escape(safe_region)}</description>',
        '',
        '    <!-- Cable Styles -->',
        '    <Style id="style_backbone"><LineStyle><color>ffea3393</color><width>4</width></LineStyle></Style>',
        '    <Style id="style_feeder"><LineStyle><color>ffe07020</color><width>3</width></LineStyle></Style>',
        '    <Style id="style_distribution"><LineStyle><color>ff0284c7</color><width>2</width></LineStyle></Style>',
        '    <Style id="style_dropcore"><LineStyle><color>ff10b981</color><width>2</width></LineStyle></Style>',
        '    <Style id="style_cable_default"><LineStyle><color>ff64748b</color><width>2</width></LineStyle></Style>',
        '',
        '    <!-- Node / Device Styles -->',
        '    <Style id="style_tiang"><IconStyle><color>ff0000ff</color><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>',
        '    <Style id="style_odp"><IconStyle><color>ff00ff00</color><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/square.png</href></Icon></IconStyle></Style>',
        '    <Style id="style_closure"><IconStyle><color>ffff9900</color><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href></Icon></IconStyle></Style>',
        '    <Style id="style_joint_closure"><IconStyle><color>ffff00aa</color><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href></Icon></IconStyle></Style>',
        '    <Style id="style_joint_box"><IconStyle><color>ffea00ff</color><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/donut.png</href></Icon></IconStyle></Style>',
        '    <Style id="style_slack"><IconStyle><color>ff00ffff</color><scale>0.9</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/caution.png</href></Icon></IconStyle></Style>',
        '    <Style id="style_pop"><IconStyle><color>ffaa00ff</color><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/purple-pushpin.png</href></Icon></IconStyle></Style>',
        '    <Style id="style_default_node"><IconStyle><color>ffffffff</color><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>',
        '',
        '    <Folder>',
        '      <name>Perangkat &amp; Tiang</name>'
    ]
    
    # Add devices
    for dev, geojson_str in devices:
        if not geojson_str: continue
        geo = json.loads(geojson_str)
        coords = geo.get("coordinates", [])
        if len(coords) < 2: continue
        lng, lat = coords[0], coords[1]
        
        dtype = (dev.device_type or "Tiang").lower()
        if "odp" in dtype:
            s_url = "#style_odp"
        elif "joint closure" in dtype:
            s_url = "#style_joint_closure"
        elif "closure" in dtype:
            s_url = "#style_closure"
        elif "joint box" in dtype:
            s_url = "#style_joint_box"
        elif "slack" in dtype:
            s_url = "#style_slack"
        elif "pop" in dtype or "olt" in dtype:
            s_url = "#style_pop"
        elif "tiang" in dtype or "pole" in dtype:
            s_url = "#style_tiang"
        else:
            s_url = "#style_default_node"
            
        desc = f"Tipe: {dev.device_type or 'Node'}\nRegion: {dev.region or '-'}\nKapasitas: {dev.used_capacity or 0}/{dev.capacity or '-'}\nCatatan: {dev.description or '-'}"
        
        kml_lines.append('      <Placemark>')
        kml_lines.append(f'        <name>{escape(dev.name or "Device")}</name>')
        kml_lines.append(f'        <description>{escape(desc)}</description>')
        if dev.icon_url:
            i_url = dev.icon_url.lower()
            color_tag = ""
            scale_val = "1.1" if "pushpin" in i_url else "1.0"
            if "placemark_circle" in i_url:
                color_tag = "<color>ff0000ff</color>" # Merah
            elif "square" in i_url:
                color_tag = "<color>ff00ff00</color>" # Hijau
            elif "triangle" in i_url:
                color_tag = "<color>ffff00aa</color>" # Ungu
            elif "donut" in i_url:
                color_tag = "<color>ffea00ff</color>" # Pink
            elif "caution" in i_url:
                color_tag = "<color>ff00ffff</color>" # Kuning
            elif "target" in i_url:
                color_tag = "<color>ffffaa00</color>" # Biru
            
            kml_lines.append('        <Style>')
            kml_lines.append('          <IconStyle>')
            if color_tag:
                kml_lines.append(f'            {color_tag}')
            kml_lines.append(f'            <scale>{scale_val}</scale>')
            kml_lines.append(f'            <Icon><href>{escape(dev.icon_url)}</href></Icon>')
            kml_lines.append('          </IconStyle>')
            kml_lines.append('        </Style>')
        else:
            kml_lines.append(f'        <styleUrl>{s_url}</styleUrl>')
        kml_lines.append('        <Point>')
        kml_lines.append(f'          <coordinates>{lng},{lat},0</coordinates>')
        kml_lines.append('        </Point>')
        kml_lines.append('      </Placemark>')
        
    kml_lines.append('    </Folder>')
    kml_lines.append('')
    kml_lines.append('    <Folder>')
    kml_lines.append('      <name>Jalur Kabel Fiber Optic</name>')
    
    # Add cables
    for cable, geojson_str in cables:
        if not geojson_str: continue
        geo = json.loads(geojson_str)
        coords = geo.get("coordinates", [])
        if len(coords) < 2: continue
        
        coord_strs = [f"{pt[0]},{pt[1]},0" for pt in coords]
        coord_block = " ".join(coord_strs)
        
        ctype = (cable.type or "").lower()
        if "backbone" in ctype:
            s_url = "#style_backbone"
        elif "feeder" in ctype:
            s_url = "#style_feeder"
        elif "drop" in ctype:
            s_url = "#style_dropcore"
        elif "distribution" in ctype:
            s_url = "#style_distribution"
        else:
            s_url = "#style_cable_default"
            
        cable_len = cable.length
        if cable_len is None or cable_len <= 0:
            import math
            R = 6371000
            total = 0.0
            for i in range(len(coords) - 1):
                p1, p2 = coords[i], coords[i+1]
                lat1, lon1 = math.radians(p1[1]), math.radians(p1[0])
                lat2, lon2 = math.radians(p2[1]), math.radians(p2[0])
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
                total += R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            cable_len = round(total, 1)

        desc = f"Tipe: {cable.type or 'Kabel'}\nKapasitas: {cable.capacity or 0} Core\nPanjang: {round(cable_len or 0, 1)} m\nRegion: {cable.region or '-'}\nCatatan: {cable.description or '-'}"
        
        kml_lines.append('      <Placemark>')
        kml_lines.append(f'        <name>{escape(cable.name or "Kabel")}</name>')
        kml_lines.append(f'        <description>{escape(desc)}</description>')
        kml_lines.append(f'        <styleUrl>{s_url}</styleUrl>')
        kml_lines.append('        <LineString>')
        kml_lines.append('          <tessellate>1</tessellate>')
        kml_lines.append(f'          <coordinates>{coord_block}</coordinates>')
        kml_lines.append('        </LineString>')
        kml_lines.append('      </Placemark>')
        
    kml_lines.append('    </Folder>')
    kml_lines.append('  </Document>')
    kml_lines.append('</kml>')
    
    kml_content = "\n".join(kml_lines)
    return kml_content, safe_region_clean

@router.get("/export-kml")
@router.get("/export-kml/")
def export_map_kml(region: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Exports all devices, cables, and PoPs for a given region (or all)
    as a raw KML file (text/xml) to avoid browser insecure download blocking.
    """
    kml_content, safe_region_clean = build_kml_document(region, db)
    filename = f"FiberCore_{safe_region_clean}.kml"
    
    return Response(
        content=kml_content.encode("utf-8"),
        media_type="application/vnd.google-earth.kml+xml",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.get("/export-kmz")
@router.get("/export-kmz/")
def export_map_kmz(region: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Exports all devices, cables, and PoPs for a given region (or all)
    as a Google Earth .kmz archive containing styled KML placemarks.
    """
    kml_content, safe_region_clean = build_kml_document(region, db)
    
    # Create KMZ zip archive in memory
    kmz_buffer = io.BytesIO()
    with zipfile.ZipFile(kmz_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("doc.kml", kml_content)
        
    kmz_bytes = kmz_buffer.getvalue()
    filename = f"FiberCore_{safe_region_clean}.kmz"
    
    return Response(
        content=kmz_bytes,
        media_type="application/vnd.google-earth.kmz",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
