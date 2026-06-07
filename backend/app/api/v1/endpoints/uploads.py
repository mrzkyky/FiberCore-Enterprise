from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
import zipfile
import io
import xml.etree.ElementTree as ET
from app.db.session import SessionLocal
from app.db.models import Cable, Core
import re

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def parse_kml_coordinates(kml_content: bytes):
    """Parses KML content and returns a list of routes (LineString) and points (Point)."""
    routes = []
    points_data = []
    
    try:
        root = ET.fromstring(kml_content)
        # KML usually has a namespace, so we need to handle it or strip it.
        for elem in root.iter():
            if '}' in elem.tag:
                elem.tag = elem.tag.split('}', 1)[1]
                
        # Find all Placemarks
        for placemark in root.findall('.//Placemark'):
            name_elem = placemark.find('name')
            name = name_elem.text if name_elem is not None else "Unknown Asset"
            
            desc_elem = placemark.find('description')
            description = desc_elem.text if desc_elem is not None else ""
            # Strip html tags if any
            description = re.sub(r'<[^>]+>', ' ', description).strip()
            
            linestring = placemark.find('.//LineString')
            point = placemark.find('.//Point')
            
            if linestring is not None:
                coords_elem = linestring.find('coordinates')
                if coords_elem is not None and coords_elem.text:
                    coords_text = coords_elem.text.strip()
                    points = []
                    for pt in coords_text.split():
                        parts = pt.split(',')
                        if len(parts) >= 2:
                            points.append(f"{parts[0]} {parts[1]}")
                            
                    if len(points) >= 2:
                        wkt = f"LINESTRING({', '.join(points)})"
                        
                        capacity = 24
                        match = re.search(r'(\d+)\s*[cC]', name)
                        if match:
                            capacity = int(match.group(1))
                            
                        ctype = "Distribution"
                        name_lower = name.lower()
                        if "feeder" in name_lower: ctype = "Feeder"
                        elif "backbone" in name_lower: ctype = "Backbone"
                        elif "drop" in name_lower: ctype = "Drop"
                            
                        routes.append({"name": name, "wkt": wkt, "capacity": capacity, "type": ctype, "description": description})
            
            elif point is not None:
                coords_elem = point.find('coordinates')
                if coords_elem is not None and coords_elem.text:
                    parts = coords_elem.text.strip().split(',')
                    if len(parts) >= 2:
                        wkt = f"POINT({parts[0]} {parts[1]})"
                        
                        # Guess device type from name
                        dtype = "Pole"
                        name_lower = name.lower()
                        if "odp" in name_lower: dtype = "ODP"
                        elif "closure" in name_lower or "jb" in name_lower or "jc" in name_lower: dtype = "Closure"
                        elif "olt" in name_lower: dtype = "OLT"
                        elif "otb" in name_lower: dtype = "OTB"
                        elif "pop" in name_lower or "sto" in name_lower: dtype = "POP" # We could map to POP table, but Device is okay for now
                            
                        points_data.append({
                            "name": name,
                            "wkt": wkt,
                            "device_type": dtype,
                            "description": description
                        })
                        
    except Exception as e:
        print(f"Error parsing KML: {e}")
        
    return {"routes": routes, "points": points_data}

TIA_COLORS = ["Blue", "Orange", "Green", "Brown", "Slate", "White", "Red", "Black", "Yellow", "Violet", "Rose", "Aqua"]

@router.post("/kml")
async def upload_kml(
    region: str = "Unknown", 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.kml', '.kmz')):
        raise HTTPException(status_code=400, detail="Only .kml and .kmz files are supported")
        
    content = await file.read()
    
    kml_data = None
    if file.filename.endswith('.kmz'):
        # Extract doc.kml from KMZ
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as kmz:
                # Find the .kml file inside
                kml_filename = next((name for name in kmz.namelist() if name.endswith('.kml')), None)
                if not kml_filename:
                    raise HTTPException(status_code=400, detail="No KML file found inside KMZ")
                kml_data = kmz.read(kml_filename)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid KMZ file format")
    else:
        kml_data = content
        
    parsed_data = parse_kml_coordinates(kml_data)
    routes = parsed_data.get("routes", [])
    points = parsed_data.get("points", [])
    
    if not routes and not points:
        raise HTTPException(status_code=400, detail="No valid LineString or Point placemarks found in the file")
        
    imported_cables = []
    imported_devices = []
    batch_id = str(uuid.uuid4())
    
    from app.db.models import Device
    
    # Save devices (Points)
    for pt in points:
        new_device = Device(
            name=pt['name'],
            device_type=pt['device_type'],
            location=func.ST_GeomFromText(pt['wkt'], 4326),
            description=pt['description']
        )
        db.add(new_device)
        imported_devices.append(pt['name'])
        
    db.commit() # Commit devices
    
    # Save routes (Cables)
    for route in routes:
        new_cable = Cable(
            name=route['name'],
            capacity=route['capacity'],
            type=route['type'],
            route=func.ST_GeomFromText(route['wkt'], 4326),
            region=region,
            import_batch=batch_id,
            description=route['description']
        )
        db.add(new_cable)
        db.flush() # Flush to get new_cable.id
        
        # Auto-generate Cores
        num_cores = route['capacity']
        cores_to_add = []
        for i in range(num_cores):
            core_num = (i % 12) + 1
            tube_num = (i // 12) + 1
            color = TIA_COLORS[i % 12]
            
            cores_to_add.append(Core(
                cable_id=new_cable.id,
                core_number=core_num,
                tube_number=tube_num,
                color=color,
                status="Free"
            ))
        
        db.bulk_save_objects(cores_to_add)
        db.commit()
        db.refresh(new_cable)
        imported_cables.append({"id": new_cable.id, "name": new_cable.name})
        
    return {
        "message": f"Successfully imported {len(imported_cables)} routes and {len(imported_devices)} devices into region {region}",
        "cables": imported_cables,
        "devices_count": len(imported_devices),
        "batch_id": batch_id
    }
