from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import SessionLocal
from app.db.models import POP, Cable, Device

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/topology")
def get_map_topology(db: Session = Depends(get_db)):
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
    devices = db.query(Device, func.ST_AsGeoJSON(Device.location).label("geojson")).filter(Device.location.is_not(None)).all()
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
                "pop_id": str(device.pop_id) if device.pop_id else None
            }
        })

    # 3. Fetch Cables as LineString Features
    cables = db.query(Cable, func.ST_AsGeoJSON(Cable.route).label("geojson")).all()
    for cable, geojson_str in cables:
        if not geojson_str:
            continue
            
        import json
        geometry = json.loads(geojson_str)
        
        # Calculate basic core stats
        # This can be expanded later, but for now we send basic capacity
        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "id": str(cable.id),
                "name": cable.name,
                "type": "cable",
                "cable_type": cable.type,
                "capacity": cable.capacity
            }
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }
