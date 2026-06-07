from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime

from app.db.session import SessionLocal
from app.db.models import Device

router = APIRouter()

# --- SCHEMAS ---
class DeviceBase(BaseModel):
    name: str
    device_type: str
    capacity: Optional[int] = None
    used_capacity: Optional[int] = 0
    brand: Optional[str] = None
    description: Optional[str] = None
    location_wkt: Optional[str] = None
    pop_id: Optional[str] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(DeviceBase):
    pass

class DeviceResponse(DeviceBase):
    id: uuid.UUID
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
@router.post("/", response_model=DeviceResponse)
def create_device(device_in: DeviceCreate, db: Session = Depends(get_db)):
    db_device = Device(**device_in.model_dump())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device

@router.get("/", response_model=List[DeviceResponse])
def get_devices(device_type: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Device)
    if device_type:
        query = query.filter(Device.device_type == device_type)
    return query.offset(skip).limit(limit).all()

@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(device_id: uuid.UUID, device_in: DeviceCreate, db: Session = Depends(get_db)):
    db_device = db.query(Device).filter(Device.id == device_id).first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    for key, value in device_in.model_dump().items():
        setattr(db_device, key, value)
        
    db.commit()
    db.refresh(db_device)
    return db_device

@router.delete("/{device_id}")
def delete_device(device_id: uuid.UUID, db: Session = Depends(get_db)):
    db_device = db.query(Device).filter(Device.id == device_id).first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    db.delete(db_device)
    db.commit()
    return {"message": "Device deleted successfully"}
