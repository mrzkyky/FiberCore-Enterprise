from fastapi import APIRouter, Depends
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
