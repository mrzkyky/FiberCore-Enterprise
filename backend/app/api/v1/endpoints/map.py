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

from typing import Optional

@router.get("/topology")
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
                "capacity": cable.capacity,
                "region": cable.region,
                "description": cable.description,
                "color": cable.color,
                "length": cable.length
            }
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }
