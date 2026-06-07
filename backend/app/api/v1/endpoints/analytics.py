from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import SessionLocal
from app.db.models import Organization, POP, Cable, Splice, Device, Core

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
    
    # Core Status Aggregation
    core_stats_query = db.query(Core.status, func.count(Core.id)).group_by(Core.status).all()
    
    core_status_data = []
    total_cores = 0
    for status, count in core_stats_query:
        core_status_data.append({"name": status, "value": count})
        total_cores += count
        
    # If no cores, provide empty mock so charts don't break
    if total_cores == 0:
        core_status_data = [
            {"name": "Free", "value": 0},
            {"name": "Spliced", "value": 0}
        ]

    # Cable Capacity Distribution (Sum of capacities)
    # We'll just group by type
    cable_type_query = db.query(Cable.type, func.count(Cable.id)).group_by(Cable.type).all()
    cable_types_data = [{"name": t if t else "Unknown", "value": c} for t, c in cable_type_query]

    # Device Distribution
    device_type_query = db.query(Device.device_type, func.count(Device.id)).group_by(Device.device_type).all()
    device_types_data = [{"name": t if t else "Unknown", "value": c} for t, c in device_type_query]

    return {
        "organizations": org_count,
        "pops": pop_count,
        "cables": cable_count,
        "splices": splice_count,
        "devices": device_count,
        "total_cores": total_cores,
        "core_status": core_status_data,
        "cable_types": cable_types_data,
        "device_types": device_types_data
    }
