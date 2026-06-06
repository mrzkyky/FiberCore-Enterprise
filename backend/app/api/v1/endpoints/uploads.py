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
    """Parses KML content and returns a list of LineString coordinates as WKT strings."""
    routes = []
    
    try:
        root = ET.fromstring(kml_content)
        # KML usually has a namespace, so we need to handle it or strip it.
        # Stripping namespace for easier search:
        for elem in root.iter():
            if '}' in elem.tag:
                elem.tag = elem.tag.split('}', 1)[1]
                
        # Find all Placemarks with LineString
        for placemark in root.findall('.//Placemark'):
            name_elem = placemark.find('name')
            name = name_elem.text if name_elem is not None else "Imported Route"
            
            linestring = placemark.find('.//LineString')
            if linestring is not None:
                coords_elem = linestring.find('coordinates')
                if coords_elem is not None and coords_elem.text:
                    coords_text = coords_elem.text.strip()
                    # coords_text is "lon,lat,alt lon,lat,alt ..."
                    points = []
                    for pt in coords_text.split():
                        parts = pt.split(',')
                        if len(parts) >= 2:
                            lon = parts[0]
                            lat = parts[1]
                            points.append(f"{lon} {lat}")
                            
                    if len(points) >= 2:
                        wkt = f"LINESTRING({', '.join(points)})"
                        
                        # Try to detect capacity from name (e.g., 144C, 48c, 96 C)
                        capacity = 24 # default
                        match = re.search(r'(\d+)\s*[cC]', name)
                        if match:
                            capacity = int(match.group(1))
                            
                        routes.append({"name": name, "wkt": wkt, "capacity": capacity})
    except Exception as e:
        print(f"Error parsing KML: {e}")
        
    return routes

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
        
    routes = parse_kml_coordinates(kml_data)
    
    if not routes:
        raise HTTPException(status_code=400, detail="No valid LineString routes found in the file")
        
    imported_cables = []
    batch_id = str(uuid.uuid4())
    
    # Save routes to database
    for route in routes:
        new_cable = Cable(
            name=route['name'],
            capacity=route['capacity'],
            type="Distribution", # Default type
            route=func.ST_GeomFromText(route['wkt'], 4326),
            region=region,
            import_batch=batch_id
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
        "message": f"Successfully imported {len(imported_cables)} routes into region {region}",
        "cables": imported_cables,
        "batch_id": batch_id
    }
