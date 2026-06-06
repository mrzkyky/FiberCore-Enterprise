from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
import zipfile
import io
import xml.etree.ElementTree as ET
from app.db.session import SessionLocal
from app.db.models import Cable

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
                        routes.append({"name": name, "wkt": wkt})
    except Exception as e:
        print(f"Error parsing KML: {e}")
        
    return routes

@router.post("/kml")
async def upload_kml(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
    # Save routes to database
    for route in routes:
        new_cable = Cable(
            name=route['name'],
            capacity=24, # Default capacity
            type="Distribution", # Default type
            route=func.ST_GeomFromText(route['wkt'], 4326)
        )
        db.add(new_cable)
        db.commit()
        db.refresh(new_cable)
        imported_cables.append({"id": new_cable.id, "name": new_cable.name})
        
    return {
        "message": f"Successfully imported {len(imported_cables)} routes",
        "cables": imported_cables
    }
