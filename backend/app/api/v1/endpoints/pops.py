from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy.orm import Session
from typing import List
from app.db.session import SessionLocal
from app.db.models import POP
from app.schemas.asset import POPCreate, POPResponse

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=POPResponse)
def create_pop(pop_in: POPCreate, db: Session = Depends(get_db)):
    db_pop = POP(**pop_in.model_dump())
    db.add(db_pop)
    db.commit()
    db.refresh(db_pop)
    return db_pop

@router.get("/", response_model=List[POPResponse])
def get_pops(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(POP).offset(skip).limit(limit).all()

@router.put("/{pop_id}", response_model=POPResponse)
def update_pop(pop_id: uuid.UUID, pop_in: POPCreate, db: Session = Depends(get_db)):
    db_pop = db.query(POP).filter(POP.id == pop_id).first()
    if not db_pop:
        raise HTTPException(status_code=404, detail="PoP not found")
    
    for key, value in pop_in.model_dump().items():
        setattr(db_pop, key, value)
        
    db.commit()
    db.refresh(db_pop)
    return db_pop

@router.delete("/{pop_id}")
def delete_pop(pop_id: uuid.UUID, db: Session = Depends(get_db)):
    db_pop = db.query(POP).filter(POP.id == pop_id).first()
    if not db_pop:
        raise HTTPException(status_code=404, detail="PoP not found")
        
    db.delete(db_pop)
    db.commit()
    return {"message": "PoP deleted successfully"}
