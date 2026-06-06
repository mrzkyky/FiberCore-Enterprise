from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import SessionLocal
from app.db.models import POP, Cable

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
        
    # 2. Fetch Cables as LineString Features
    # Nanti kita akan tambahkan kolom 'route' di tabel Cable
    # Untuk sementara, kita return features yang ada
    
    return {
        "type": "FeatureCollection",
        "features": features
    }
