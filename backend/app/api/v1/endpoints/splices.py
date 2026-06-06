from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from app.db.session import SessionLocal
from app.db.models import Splice, Core
from app.schemas.asset import SpliceCreate, SpliceResponse

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=SpliceResponse)
def create_splice(splice_in: SpliceCreate, db: Session = Depends(get_db)):
    # Verify cores exist
    core_a = db.query(Core).filter(Core.id == splice_in.core_a_id).first()
    core_b = db.query(Core).filter(Core.id == splice_in.core_b_id).first()

    if not core_a or not core_b:
        raise HTTPException(status_code=404, detail="One or both Cores not found")

    if core_a.status == "Spliced" or core_b.status == "Spliced":
        raise HTTPException(status_code=400, detail="One or both Cores are already spliced")

    # Create splice
    db_splice = Splice(**splice_in.model_dump())
    db.add(db_splice)

    # Update cores status
    core_a.status = "Spliced"
    core_b.status = "Spliced"

    db.commit()
    db.refresh(db_splice)
    return db_splice

@router.get("/", response_model=List[SpliceResponse])
def get_splices(closure_id: uuid.UUID = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Splice)
    if closure_id:
        query = query.filter(Splice.closure_id == closure_id)
    return query.offset(skip).limit(limit).all()

@router.delete("/{splice_id}")
def delete_splice(splice_id: uuid.UUID, db: Session = Depends(get_db)):
    db_splice = db.query(Splice).filter(Splice.id == splice_id).first()
    if not db_splice:
        raise HTTPException(status_code=404, detail="Splice not found")

    # Free the cores
    core_a = db.query(Core).filter(Core.id == db_splice.core_a_id).first()
    core_b = db.query(Core).filter(Core.id == db_splice.core_b_id).first()

    if core_a: core_a.status = "Free"
    if core_b: core_b.status = "Free"

    db.delete(db_splice)
    db.commit()
    return {"message": "Splice deleted and cores freed"}
