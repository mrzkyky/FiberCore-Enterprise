from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime

from app.db.session import SessionLocal
from app.db.models import Device, Port

router = APIRouter()

from sqlalchemy import func

# --- SCHEMAS ---
class DeviceBase(BaseModel):
    name: str
    device_type: str
    capacity: Optional[int] = None
    used_capacity: Optional[int] = 0
    brand: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_wkt: Optional[str] = None
    pop_id: Optional[uuid.UUID] = None
    region: Optional[str] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    device_type: Optional[str] = None
    capacity: Optional[int] = None
    used_capacity: Optional[int] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_wkt: Optional[str] = None
    pop_id: Optional[uuid.UUID] = None
    region: Optional[str] = None
    icon_url: Optional[str] = None

class DeviceResponse(BaseModel):
    id: uuid.UUID
    name: str
    device_type: str
    capacity: Optional[int] = None
    used_capacity: Optional[int] = 0
    brand: Optional[str] = None
    description: Optional[str] = None
    region: Optional[str] = None
    icon_url: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# --- DEPENDENCY ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- ROUTES ---
@router.post("")
@router.post("/")
def create_device(device_in: DeviceCreate, db: Session = Depends(get_db)):
    loc = None
    if device_in.longitude is not None and device_in.latitude is not None:
        loc = func.ST_SetSRID(func.ST_MakePoint(device_in.longitude, device_in.latitude), 4326)
    elif device_in.location_wkt:
        loc = func.ST_GeomFromText(device_in.location_wkt, 4326)
        
    db_device = Device(
        name=device_in.name,
        device_type=device_in.device_type,
        capacity=device_in.capacity,
        used_capacity=device_in.used_capacity or 0,
        brand=device_in.brand,
        description=device_in.description,
        location=loc,
        pop_id=device_in.pop_id,
        region=device_in.region
    )
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    
    if device_in.capacity and device_in.capacity > 0:
        dtype_upper = (device_in.device_type or "").upper()
        if any(t in dtype_upper for t in ["ODP", "OLT", "OTB", "CLOSURE", "POP"]):
            ports = [Port(device_id=db_device.id, port_number=i+1, status="Free") for i in range(device_in.capacity)]
            db.add_all(ports)
            db.commit()

    return {
        "id": str(db_device.id),
        "name": db_device.name,
        "device_type": db_device.device_type,
        "region": db_device.region,
        "message": "Device created successfully"
    }

@router.get("", response_model=List[DeviceResponse])
@router.get("/", response_model=List[DeviceResponse])
def get_devices(device_type: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Device)
    if device_type:
        query = query.filter(Device.device_type == device_type)
    return query.offset(skip).limit(limit).all()

@router.put("/{device_id}")
def update_device(device_id: uuid.UUID, device_in: DeviceUpdate, db: Session = Depends(get_db)):
    db_device = db.query(Device).filter(Device.id == device_id).first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    for key, value in device_in.model_dump(exclude_unset=True).items():
        if key in ["latitude", "longitude", "location_wkt"]:
            continue
        setattr(db_device, key, value)
        
    if device_in.longitude is not None and device_in.latitude is not None:
        db_device.location = func.ST_SetSRID(func.ST_MakePoint(device_in.longitude, device_in.latitude), 4326)
    elif device_in.location_wkt:
        db_device.location = func.ST_GeomFromText(device_in.location_wkt, 4326)
        
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        err_msg = str(e).lower()
        if "icon_url" in err_msg or "column" in err_msg:
            from sqlalchemy import text
            try:
                db.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS icon_url VARCHAR;"))
                db.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS description VARCHAR;"))
                db.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS used_capacity INTEGER DEFAULT 0;"))
                db.commit()
                db_device = db.query(Device).filter(Device.id == device_id).first()
                for key, value in device_in.model_dump(exclude_unset=True).items():
                    if key in ["latitude", "longitude", "location_wkt"]:
                        continue
                    setattr(db_device, key, value)
                db.commit()
            except Exception as e2:
                db.rollback()
                raise HTTPException(status_code=500, detail=f"Database migration error: {str(e2)}")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to update device: {str(e)}")
            
    db.refresh(db_device)
    
    if device_in.capacity and device_in.capacity > 0:
        dtype_upper = (device_in.device_type or "").upper()
        if any(t in dtype_upper for t in ["ODP", "OLT", "OTB", "CLOSURE", "POP"]):
            ports = [Port(device_id=db_device.id, port_number=i+1, status="Free") for i in range(device_in.capacity)]
            db.add_all(ports)
            db.commit()

    return {"message": "Device updated successfully"}

@router.delete("/{device_id}")
def delete_device(device_id: uuid.UUID, db: Session = Depends(get_db)):
    db_device = db.query(Device).filter(Device.id == device_id).first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    db.delete(db_device)
    db.commit()
    return {"message": "Device deleted successfully"}
