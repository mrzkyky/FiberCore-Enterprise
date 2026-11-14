from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from app.db.session import SessionLocal
from app.db.models import Cable, Core, Device
from app.schemas.asset import CableCreate, CableResponse, CoreResponse
import uuid
import math

router = APIRouter()

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class CableDrawPayload(BaseModel):
    name: str
    capacity: int = 12
    type: str = "Distribution" # Backbone, Feeder, Distribution, Dropcore
    region: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    coordinates: List[List[float]] # [[lng, lat], [lng, lat], ...]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/regions")
def get_all_regions(db: Session = Depends(get_db)):
    """Returns all unique region names from both cables and devices."""
    from sqlalchemy import union_all
    cable_regions = db.query(Cable.region).filter(Cable.region != None).distinct()
    device_regions = db.query(Device.region).filter(Device.region != None).distinct()
    all_regions = set()
    for (r,) in cable_regions:
        all_regions.add(r)
    for (r,) in device_regions:
        all_regions.add(r)
    return sorted(list(all_regions))

@router.post("/draw")
def create_drawn_cable(payload: CableDrawPayload, db: Session = Depends(get_db)):
    if len(payload.coordinates) < 2:
        raise HTTPException(status_code=400, detail="Cable must contain at least 2 coordinate points")
        
    wkt_coords = ", ".join([f"{pt[0]} {pt[1]}" for pt in payload.coordinates])
    wkt = f"LINESTRING({wkt_coords})"
    
    total_len = 0.0
    for i in range(len(payload.coordinates) - 1):
        p1 = payload.coordinates[i]
        p2 = payload.coordinates[i+1]
        total_len += haversine(p1[1], p1[0], p2[1], p2[0])
        
    color_map = {
        "Backbone": "#e11d48",
        "Feeder": "#ea580c",
        "Distribution": "#0284c7",
        "Dropcore": "#10b981"
    }
    cable_color = payload.color or color_map.get(payload.type, "#475569")
    
    db_cable = Cable(
        name=payload.name,
        capacity=payload.capacity,
        type=payload.type,
        route=func.ST_GeomFromText(wkt, 4326),
        region=payload.region,
        color=cable_color,
        length=round(total_len, 2),
        description=payload.description
    )
    db.add(db_cable)
    db.commit()
    db.refresh(db_cable)
    
    # Standard 12 TIA Fiber Colors
    colors = ["Blue", "Orange", "Green", "Brown", "Slate", "White", "Red", "Black", "Yellow", "Violet", "Rose", "Aqua"]
    cores = []
    for i in range(1, payload.capacity + 1):
        cores.append(Core(
            cable_id=db_cable.id,
            core_number=i,
            tube_number=((i - 1) // 12) + 1,
            color=colors[(i - 1) % 12],
            status="Free"
        ))
    db.add_all(cores)
    db.commit()
    
    return {
        "id": str(db_cable.id),
        "name": db_cable.name,
        "length": db_cable.length,
        "region": db_cable.region,
        "message": "Cable drawn and saved successfully"
    }

@router.post("/", response_model=CableResponse)
def create_cable(cable_in: CableCreate, db: Session = Depends(get_db)):
    db_cable = Cable(**cable_in.model_dump())
    db.add(db_cable)
    db.commit()
    db.refresh(db_cable)
    
    # Fiber Color Standard (12 Colors)
    colors = [
        "Blue", "Orange", "Green", "Brown", "Slate", "White", 
        "Red", "Black", "Yellow", "Violet", "Rose", "Aqua"
    ]
    
    cores_to_add = []
    # Otomatis generate Cores berdasarkan kapasitas
    for i in range(1, cable_in.capacity + 1):
        tube_number = ((i - 1) // 12) + 1
        color_index = ((i - 1) % 12)
        core_color = colors[color_index]
        
        cores_to_add.append(Core(
            cable_id=db_cable.id,
            core_number=i,
            tube_number=tube_number,
            color=core_color
        ))
    
    db.add_all(cores_to_add)
    db.commit()
    
    return db_cable

@router.get("/", response_model=List[CableResponse])
def get_cables(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Cable).offset(skip).limit(limit).all()

@router.put("/{cable_id}", response_model=CableResponse)
def update_cable(cable_id: uuid.UUID, cable_in: CableCreate, db: Session = Depends(get_db)):
    db_cable = db.query(Cable).filter(Cable.id == cable_id).first()
    if not db_cable:
        raise HTTPException(status_code=404, detail="Cable not found")
    
    for key, value in cable_in.model_dump().items():
        setattr(db_cable, key, value)
        
    db.commit()
    db.refresh(db_cable)
    return db_cable

@router.delete("/region/{region_name}")
def delete_cables_by_region(region_name: str, db: Session = Depends(get_db)):
    cables = db.query(Cable).filter(Cable.region == region_name).all()
    if not cables:
        raise HTTPException(status_code=404, detail="No cables found for this region")
    
    deleted_count = 0
    for c in cables:
        # DB relationship cascade delete-orphan will handle cores
        db.delete(c)
        deleted_count += 1
        
    db.commit()
    return {"message": f"Successfully deleted {deleted_count} cables in region '{region_name}'"}

@router.delete("/batch/{batch_id}")
def delete_cables_by_batch(batch_id: str, db: Session = Depends(get_db)):
    cables = db.query(Cable).filter(Cable.import_batch == batch_id).all()
    devices = db.query(Device).filter(Device.import_batch == batch_id).all()
    
    if not cables and not devices:
        raise HTTPException(status_code=404, detail="No data found for this batch")
    
    deleted_cables_count = 0
    for c in cables:
        db.delete(c)
        deleted_cables_count += 1
        
    deleted_devices_count = 0
    for d in devices:
        db.delete(d)
        deleted_devices_count += 1
        
    db.commit()
    return {"message": f"Successfully deleted {deleted_cables_count} cables and {deleted_devices_count} devices in batch '{batch_id}'"}

@router.delete("/{cable_id}")
def delete_cable(cable_id: uuid.UUID, db: Session = Depends(get_db)):
    db_cable = db.query(Cable).filter(Cable.id == cable_id).first()
    if not db_cable:
        raise HTTPException(status_code=404, detail="Cable not found")
    
    # Delete associated cores first
    db.query(Core).filter(Core.cable_id == cable_id).delete()
    db.delete(db_cable)
    db.commit()
    return {"message": "Cable and its cores deleted successfully"}

@router.get("/{cable_id}/cores", response_model=List[CoreResponse])
def get_cable_cores(cable_id: uuid.UUID, db: Session = Depends(get_db)):
    db_cable = db.query(Cable).filter(Cable.id == cable_id).first()
    if not db_cable:
        raise HTTPException(status_code=404, detail="Cable not found")
    
    return db.query(Core).filter(Core.cable_id == cable_id).order_by(Core.core_number).all()
