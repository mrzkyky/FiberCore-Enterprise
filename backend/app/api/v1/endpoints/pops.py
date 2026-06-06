from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy.orm import Session
from typing import List
from app.db.session import SessionLocal
from app.db.models import POP
from app.schemas.asset import POPCreate, POPResponse
from sqlalchemy import func

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=POPResponse)
def create_pop(pop_in: POPCreate, db: Session = Depends(get_db)):
    if pop_in.location:
        db_pop = POP(
            name=pop_in.name,
            org_id=pop_in.org_id,
            location=func.ST_GeomFromText(pop_in.location, 4326)
        )
    else:
        db_pop = POP(name=pop_in.name, org_id=pop_in.org_id)
        
    db.add(db_pop)
    db.commit()
    db.refresh(db_pop)
    
    # Re-query to get location as text
    if db_pop.location:
        loc_str = db.query(func.ST_AsText(POP.location)).filter(POP.id == db_pop.id).scalar()
    else:
        loc_str = None
        
    return {
        "id": db_pop.id,
        "name": db_pop.name,
        "org_id": db_pop.org_id,
        "location": loc_str
    }

@router.get("/", response_model=List[POPResponse])
def get_pops(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    pops = db.query(POP, func.ST_AsText(POP.location).label("loc_str")).offset(skip).limit(limit).all()
    result = []
    for pop, loc_str in pops:
        result.append({
            "id": pop.id,
            "name": pop.name,
            "org_id": pop.org_id,
            "location": loc_str
        })
    return result

@router.put("/{pop_id}", response_model=POPResponse)
def update_pop(pop_id: uuid.UUID, pop_in: POPCreate, db: Session = Depends(get_db)):
    db_pop = db.query(POP).filter(POP.id == pop_id).first()
    if not db_pop:
        raise HTTPException(status_code=404, detail="PoP not found")
    
    db_pop.name = pop_in.name
    db_pop.org_id = pop_in.org_id
    if pop_in.location:
        db_pop.location = func.ST_GeomFromText(pop_in.location, 4326)
        
    db.commit()
    db.refresh(db_pop)
    
    # Re-query to get location as text
    if db_pop.location:
        loc_str = db.query(func.ST_AsText(POP.location)).filter(POP.id == db_pop.id).scalar()
    else:
        loc_str = None
        
    return {
        "id": db_pop.id,
        "name": db_pop.name,
        "org_id": db_pop.org_id,
        "location": loc_str
    }

@router.delete("/{pop_id}")
def delete_pop(pop_id: uuid.UUID, db: Session = Depends(get_db)):
    db_pop = db.query(POP).filter(POP.id == pop_id).first()
    if not db_pop:
        raise HTTPException(status_code=404, detail="PoP not found")
        
    db.delete(db_pop)
    db.commit()
    return {"message": "PoP deleted successfully"}
