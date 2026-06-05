from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import SessionLocal
from app.db.models import Cable, Core
from app.schemas.asset import CableCreate, CableResponse

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
