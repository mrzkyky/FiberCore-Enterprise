from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import Organization, POP, Cable, Splice, Device

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    org_count = db.query(Organization).count()
    pop_count = db.query(POP).count()
    cable_count = db.query(Cable).count()
    splice_count = db.query(Splice).count()
    device_count = db.query(Device).count()
    
    # Optional: We could sum cable capacities or lengths here.
    
    return {
        "organizations": org_count,
        "pops": pop_count,
        "cables": cable_count,
        "splices": splice_count,
        "devices": device_count
    }
