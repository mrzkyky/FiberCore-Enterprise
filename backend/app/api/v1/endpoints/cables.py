from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import SessionLocal
from app.db.models import Cable, Core
from app.schemas.asset import CableCreate, CableResponse, CoreResponse
import uuid

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
