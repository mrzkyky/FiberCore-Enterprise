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

@router.get("/matrix/{device_id}")
def get_splice_matrix(device_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Returns a detailed splicing matrix for a given Closure/Device.
    Includes involved cables, their capacity, and the exact core-to-core mapping.
    """
    splices = db.query(Splice).filter(Splice.closure_id == device_id).all()
    
    matrix = []
    cables_info = {}
    
    for splice in splices:
        core_a = splice.core_a
        core_b = splice.core_b
        
        # Track cables
        for c in [core_a, core_b]:
            if c and c.cable_id not in cables_info:
                cable = c.cable
                # Count used cores for this cable inside this closure?
                # Or total used in cable? Let's give cable stats
                cables_info[c.cable_id] = {
                    "id": str(cable.id),
                    "name": cable.name,
                    "capacity": cable.capacity,
                    "type": cable.type
                }
                
        matrix.append({
            "splice_id": str(splice.id),
            "attenuation": splice.attenuation,
            "core_a": {
                "id": str(core_a.id) if core_a else None,
                "cable_id": str(core_a.cable_id) if core_a else None,
                "core_number": core_a.core_number if core_a else None,
                "tube_number": core_a.tube_number if core_a else None,
                "color": core_a.color if core_a else None,
            },
            "core_b": {
                "id": str(core_b.id) if core_b else None,
                "cable_id": str(core_b.cable_id) if core_b else None,
                "core_number": core_b.core_number if core_b else None,
                "tube_number": core_b.tube_number if core_b else None,
                "color": core_b.color if core_b else None,
            }
        })
        
    return {
        "device_id": str(device_id),
        "cables": list(cables_info.values()),
        "splices": matrix
    }

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
