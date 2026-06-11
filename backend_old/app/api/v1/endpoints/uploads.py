from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
import zipfile
import io
import xml.etree.ElementTree as ET
from app.db.session import SessionLocal
from app.db.models import Cable, Core, Device
import re
import base64
import math

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def parse_kml_styles(root):
    styles = {}
    for style in root.findall('.//Style'):
        style_id = style.get('id')
        if not style_id: continue
        style_data = {}
        
        line_style = style.find('.//LineStyle')
        if line_style is not None:
            color_elem = line_style.find('color')
            if color_elem is not None and color_elem.text:
                # KML color is aabbggrr, we need #rrggbb
                raw = color_elem.text.strip()
                if len(raw) == 8:
                    a, b, g, r = raw[0:2], raw[2:4], raw[4:6], raw[6:8]
                    style_data['line_color'] = f"#{r}{g}{b}"
                    
        icon_style = style.find('.//IconStyle')
        if icon_style is not None:
            href_elem = icon_style.find('.//href')
            if href_elem is not None and href_elem.text:
                style_data['icon_href'] = href_elem.text.strip()
                
        styles[style_id] = style_data
        
    for style_map in root.findall('.//StyleMap'):
        map_id = style_map.get('id')
        if not map_id: continue
        pair = style_map.find('.//Pair')
        if pair is not None:
            url_elem = pair.find('styleUrl')
            if url_elem is not None and url_elem.text:
                target = url_elem.text.replace('#', '')
                if target in styles:
                    styles[map_id] = styles[target]
    return styles

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000 # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_linestring_length(coords_list):
    total_length = 0.0
    for i in range(len(coords_list) - 1):
        try:
            lon1, lat1 = map(float, coords_list[i].split())
            lon2, lat2 = map(float, coords_list[i+1].split())
            total_length += haversine(lat1, lon1, lat2, lon2)
        except:
            pass
    return total_length

def parse_kml_coordinates(kml_content: bytes, kmz_zip: zipfile.ZipFile = None):
    routes = []
    points_data = []
    
    try:
        root = ET.fromstring(kml_content)
        for elem in root.iter():
            if '}' in elem.tag:
                elem.tag = elem.tag.split('}', 1)[1]
                
        styles = parse_kml_styles(root)
        
        def classify_point(name, description, folder_name):
            """Classify a point placemark into a device type using both name and folder context."""
            name_lower = (name or "").lower().strip()
            desc_lower = (description or "").lower()
            folder_lower = (folder_name or "").lower()
            
            # High-priority: specific device types from placemark name (only if name is descriptive)
            if "odp" in name_lower:
                return "ODP"
            elif "jc" in name_lower or "joint closure" in name_lower:
                return "Joint Closure"
            elif "jb" in name_lower or "joint box" in name_lower:
                return "Joint Box"
            elif "closure" in name_lower and "joint" not in name_lower:
                return "Closure"
            elif "olt" in name_lower:
                return "OLT"
            elif "otb" in name_lower:
                return "OTB"
            elif "pop" in name_lower or "sto" in name_lower:
                return "POP"
            elif "oloop" in name_lower or "slack" in name_lower or name_lower == "sk":
                return "Slack"
            
            # Medium-priority: folder-based classification
            # This is critical for KMZ files where placemarks have generic names like "T"
            if "odp" in folder_lower:
                return "ODP"
            elif "joint closure" in folder_lower or folder_lower.strip() == "jc":
                return "Joint Closure"
            elif "joint box" in folder_lower or folder_lower.strip() == "jb":
                return "Joint Box"
            elif "closure" in folder_lower and "joint" not in folder_lower:
                return "Closure"
            elif "slack" in folder_lower or "oloop" in folder_lower or "reserve" in folder_lower:
                return "Slack"
            
            # Pole sub-typing: Tiang Spek from folder or name
            if "spek" in folder_lower or "spec" in folder_lower or "tahap" in folder_lower:
                return "Tiang Spek"
            if "tahap" in name_lower or "spek" in name_lower or "spec" in name_lower:
                return "Tiang Spek"
            
            # Default: Pole (Tiang Biasa)
            return "Pole"
        
        def process_placemark(placemark, folder_name=""):
            """Process a single Placemark element."""
            name_elem = placemark.find('name')
            name = name_elem.text.strip() if name_elem is not None and name_elem.text else "Unknown Asset"
            
            desc_elem = placemark.find('description')
            description = desc_elem.text if desc_elem is not None else ""
            description = re.sub(r'<[^>]+>', ' ', description).strip()
            
            style_url_elem = placemark.find('styleUrl')
            resolved_style = {}
            if style_url_elem is not None and style_url_elem.text:
                s_id = style_url_elem.text.replace('#', '')
                resolved_style = styles.get(s_id, {})
            
            linestring = placemark.find('.//LineString')
            point = placemark.find('.//Point')
            
            if linestring is not None:
                coords_elem = linestring.find('coordinates')
                if coords_elem is not None and coords_elem.text:
                    coords_text = coords_elem.text.strip()
                    coord_points = []
                    for pt in coords_text.split():
                        parts = pt.split(',')
                        if len(parts) >= 2:
                            coord_points.append(f"{parts[0]} {parts[1]}")
                            
                    if len(coord_points) >= 2:
                        wkt = f"LINESTRING({', '.join(coord_points)})"
                        
                        length_meters = calculate_linestring_length(coord_points)
                        
                        capacity = 24
                        match = re.search(r'(\d+)\s*[cC]', name)
                        if match:
                            capacity = int(match.group(1))
                            
                        ctype = "Distribution"
                        name_lower = name.lower()
                        folder_lower = (folder_name or "").lower()
                        
                        if "feeder" in name_lower or "feeder" in folder_lower: 
                            ctype = "Feeder"
                        elif "backbone" in name_lower or "backbone" in folder_lower: 
                            ctype = "Backbone"
                        elif "drop" in name_lower or "drop" in folder_lower: 
                            ctype = "Dropcore"
                        else:
                            if capacity >= 96:
                                ctype = "Backbone"
                            elif capacity >= 24:
                                ctype = "Feeder"
                            else:
                                ctype = "Distribution"
                            
                        line_color = resolved_style.get('line_color', None)
                        routes.append({
                            "name": name, "wkt": wkt, "capacity": capacity, 
                            "type": ctype, "description": description, "color": line_color,
                            "length": length_meters
                        })
            
            elif point is not None:
                coords_elem = point.find('coordinates')
                if coords_elem is not None and coords_elem.text:
                    parts = coords_elem.text.strip().split(',')
                    if len(parts) >= 2:
                        wkt = f"POINT({parts[0]} {parts[1]})"
                        
                        dtype = classify_point(name, description, folder_name)
                        
                        icon_href = resolved_style.get('icon_href', None)
                        icon_url_base64 = None
                        
                        # Process icon
                        if icon_href:
                            if icon_href.startswith('http'):
                                icon_url_base64 = icon_href
                            elif kmz_zip is not None:
                                # Extract from zip
                                try:
                                    img_data = kmz_zip.read(icon_href)
                                    ext = icon_href.split('.')[-1].lower()
                                    mime = f"image/{ext}" if ext in ['png', 'jpg', 'jpeg', 'gif'] else "image/png"
                                    b64 = base64.b64encode(img_data).decode('utf-8')
                                    icon_url_base64 = f"data:{mime};base64,{b64}"
                                except Exception as e:
                                    print(f"Failed to extract icon {icon_href}: {e}")

                        points_data.append({
                            "name": name,
                            "wkt": wkt,
                            "device_type": dtype,
                            "description": description,
                            "icon_url": icon_url_base64
                        })
        
        def process_element(element, folder_path=""):
            """Recursively process Folders and Placemarks, carrying accumulated folder path context."""
            # Process direct Placemark children of this element
            for placemark in element.findall('Placemark'):
                process_placemark(placemark, folder_path)
            
            # Recurse into Folder children
            for folder in element.findall('Folder'):
                folder_name_elem = folder.find('name')
                folder_name = folder_name_elem.text.strip() if folder_name_elem is not None and folder_name_elem.text else ""
                new_folder_path = f"{folder_path} | {folder_name}" if folder_path else folder_name
                process_element(folder, new_folder_path)
        
        # Start from root Document (or root itself)
        doc = root.find('Document')
        if doc is None:
            doc = root
        
        process_element(doc)
                        
    except Exception as e:
        print(f"Error parsing KML: {e}")
        import traceback
        traceback.print_exc()
        
    return {"routes": routes, "points": points_data}

TIA_COLORS = ["Blue", "Orange", "Green", "Brown", "Slate", "White", "Red", "Black", "Yellow", "Violet", "Rose", "Aqua"]

@router.post("/kml")
async def upload_kml(
    region: str = "Unknown", 
    replace: bool = False,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.kml', '.kmz')):
        raise HTTPException(status_code=400, detail="Only .kml and .kmz files are supported")
        
    content = await file.read()
    
    kml_data = None
    kmz_zip = None
    
    if file.filename.endswith('.kmz'):
        try:
            kmz_zip = zipfile.ZipFile(io.BytesIO(content))
            kml_filename = next((name for name in kmz_zip.namelist() if name.endswith('.kml')), None)
            if not kml_filename:
                raise HTTPException(status_code=400, detail="No KML file found inside KMZ")
            kml_data = kmz_zip.read(kml_filename)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid KMZ file format")
    else:
        kml_data = content
        
    parsed_data = parse_kml_coordinates(kml_data, kmz_zip)
    
    # Close zip if we opened it
    if kmz_zip:
        kmz_zip.close()
        
    routes = parsed_data.get("routes", [])
    points = parsed_data.get("points", [])
    
    if not routes and not points:
        raise HTTPException(status_code=400, detail="No valid LineString or Point placemarks found in the file")
        
    if replace:
        # Delete existing devices in region
        db.query(Device).filter(Device.region == region).delete(synchronize_session=False)
        # Delete existing cables in region (Cores should cascade if configured, but we do manual just in case)
        existing_cables = db.query(Cable).filter(Cable.region == region).all()
        for c in existing_cables:
            db.query(Core).filter(Core.cable_id == c.id).delete(synchronize_session=False)
            db.delete(c)
        db.commit()

    imported_cables = []
    imported_devices = []
    batch_id = str(uuid.uuid4())
    
    for pt in points:
        new_device = Device(
            name=pt['name'],
            device_type=pt['device_type'],
            location=func.ST_GeomFromText(pt['wkt'], 4326),
            description=pt['description'],
            icon_url=pt['icon_url'],
            region=region,
            import_batch=batch_id
        )
        db.add(new_device)
        imported_devices.append(pt['name'])
        
    db.commit()
    
    for route in routes:
        new_cable = Cable(
            name=route['name'],
            capacity=route['capacity'],
            type=route['type'],
            route=func.ST_GeomFromText(route['wkt'], 4326),
            region=region,
            import_batch=batch_id,
            description=route['description'],
            color=route['color'],
            length=route.get('length')
        )
        db.add(new_cable)
        db.flush()
        
        num_cores = route['capacity']
        cores_to_add = []
        for i in range(num_cores):
            cores_to_add.append(Core(
                cable_id=new_cable.id,
                core_number=(i % 12) + 1,
                tube_number=(i // 12) + 1,
                color=TIA_COLORS[i % 12],
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
