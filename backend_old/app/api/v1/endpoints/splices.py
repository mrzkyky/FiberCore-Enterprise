from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import uuid
from app.db.session import SessionLocal
from app.db.models import Splice, Core, Cable, Device
from app.schemas.asset import SpliceCreate, SpliceResponse

router = APIRouter()

class BatchSplicePayload(BaseModel):
    cable_a_id: uuid.UUID
    cable_b_id: uuid.UUID
    closure_id: Optional[uuid.UUID] = None
    start_core_a: int = 1
    start_core_b: int = 1
    count: int = 12
    attenuation: float = 0.05
    auto_update_description: bool = True
    custom_note: Optional[str] = None

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/batch-connect")
@router.post("/batch-connect/")
def batch_connect_cables(payload: BatchSplicePayload, db: Session = Depends(get_db)):
    """
    Slices multiple cores between two cables in batch (e.g., project pelebaran / expansion)
    and automatically logs/updates cable descriptions with connection details.
    """
    cable_a = db.query(Cable).filter(Cable.id == payload.cable_a_id).first()
    cable_b = db.query(Cable).filter(Cable.id == payload.cable_b_id).first()

    if not cable_a or not cable_b:
        raise HTTPException(status_code=404, detail="One or both cables not found")

    cores_a = db.query(Core).filter(Core.cable_id == cable_a.id).order_by(Core.core_number).all()
    cores_b = db.query(Core).filter(Core.cable_id == cable_b.id).order_by(Core.core_number).all()

    closure = None
    if payload.closure_id:
        closure = db.query(Device).filter(Device.id == payload.closure_id).first()
    
    if not closure:
        # Check or create default Joint Closure
        closure = db.query(Device).filter(Device.device_type.in_(["Closure", "Joint Closure"])).first()
        if not closure:
            closure = Device(
                name=f"JC-{cable_a.name[:8]}-{cable_b.name[:8]}",
                device_type="Joint Closure",
                region=cable_b.region or cable_a.region,
                capacity=48,
                description="Auto-generated joint closure for network expansion"
            )
            db.add(closure)
            db.commit()
            db.refresh(closure)

    spliced_count = 0
    splice_details = []

    for i in range(payload.count):
        idx_a = payload.start_core_a - 1 + i
        idx_b = payload.start_core_b - 1 + i

        if idx_a >= len(cores_a) or idx_b >= len(cores_b):
            break

        ca = cores_a[idx_a]
        cb = cores_b[idx_b]

        # Check existing splice
        existing = db.query(Splice).filter(
            ((Splice.core_a_id == ca.id) & (Splice.core_b_id == cb.id)) |
            ((Splice.core_a_id == cb.id) & (Splice.core_b_id == ca.id))
        ).first()

        if not existing:
            sp = Splice(
                core_a_id=ca.id,
                core_b_id=cb.id,
                closure_id=closure.id,
                attenuation=payload.attenuation
            )
            db.add(sp)
            ca.status = "Spliced"
            cb.status = "Spliced"
            spliced_count += 1
            splice_details.append(f"C{ca.core_number}({ca.color}) <-> C{cb.core_number}({cb.color})")

    if spliced_count == 0:
        raise HTTPException(status_code=400, detail="No cores were available or eligible to be spliced")

    if payload.auto_update_description:
        range_a = f"C{payload.start_core_a}-C{payload.start_core_a + spliced_count - 1}"
        range_b = f"C{payload.start_core_b}-C{payload.start_core_b + spliced_count - 1}"
        closure_label = closure.name if closure else "Joint"
        
        note_for_a = f"[Pelebaran: {range_a} sambung ke {cable_b.name} ({range_b}) via {closure_label}]"
        note_for_b = f"[Pelebaran: {range_b} sambung dari {cable_a.name} ({range_a}) via {closure_label}]"
        
        if payload.custom_note:
            note_for_a += f" Catatan: {payload.custom_note}"
            note_for_b += f" Catatan: {payload.custom_note}"

        cable_a.description = f"{cable_a.description} | {note_for_a}" if cable_a.description else note_for_a
        cable_b.description = f"{cable_b.description} | {note_for_b}" if cable_b.description else note_for_b

    db.commit()

    return {
        "message": f"Berhasil menyambungkan {spliced_count} core antara '{cable_a.name}' dan '{cable_b.name}'",
        "spliced_count": spliced_count,
        "closure_name": closure.name if closure else None,
        "details": splice_details,
        "description_a": cable_a.description,
        "description_b": cable_b.description
    }

@router.post("", response_model=SpliceResponse)
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
        
    # Calculate analytics
    total_cables = len(cables_info)
    total_spliced_cores = len(matrix) * 2
    
    # Calculate free cores from all involved cables
    total_free_cores = 0
    for cable_id in cables_info.keys():
        # Count cores with status 'Free' for this cable
        free_count = db.query(Core).filter(Core.cable_id == cable_id, Core.status == "Free").count()
        total_free_cores += free_count
        
    return {
        "device_id": str(device_id),
        "cables": list(cables_info.values()),
        "splices": matrix,
        "analytics": {
            "total_cables_connected": total_cables,
            "total_spliced_cores": total_spliced_cores,
            "total_free_cores": total_free_cores
        }
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

@router.get("/trace/{core_id}")
def trace_core(core_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Traces a core end-to-end to find all connected cores and splices.
    Returns an ordered linear path from one end to the other.
    """
    # 1. Find all reachable cores and splices
    visited_cores = set()
    visited_splices = set()
    
    # Build graph in memory
    # Because a path might be long, doing DB queries in a loop is okay for small scale.
    # For large scale, we'd use recursive CTE, but let's keep it simple first.
    
    def get_neighbors(c_id):
        # Fetch splices connected to this core
        splices = db.query(Splice).filter(
            (Splice.core_a_id == c_id) | (Splice.core_b_id == c_id)
        ).all()
        neighbors = []
        for s in splices:
            other_id = s.core_b_id if s.core_a_id == c_id else s.core_a_id
            neighbors.append((other_id, s))
        return neighbors

    # BFS to find all connected nodes
    queue = [core_id]
    all_cores = set()
    
    while queue:
        current = queue.pop(0)
        if current in visited_cores:
            continue
        visited_cores.add(current)
        all_cores.add(current)
        
        for neighbor_id, splice in get_neighbors(current):
            visited_splices.add(splice)
            if neighbor_id not in visited_cores:
                queue.append(neighbor_id)
                
    # If it's just one core (not spliced), return it
    if len(all_cores) == 1:
        core = db.query(Core).filter(Core.id == core_id).first()
        if not core:
            raise HTTPException(status_code=404, detail="Core not found")
        cable = core.cable
        return {
            "path": [{
                "core_id": str(core.id),
                "cable_name": cable.name,
                "color": core.color,
                "tube": core.tube_number,
                "status": core.status
            }],
            "total_attenuation": 0
        }
        
    # Find an endpoint (a core with exactly 1 splice in the component)
    # Count degree of each core
    degree = {c: 0 for c in all_cores}
    for s in visited_splices:
        if s.core_a_id in degree: degree[s.core_a_id] += 1
        if s.core_b_id in degree: degree[s.core_b_id] += 1
        
    endpoints = [c for c, deg in degree.items() if deg == 1]
    
    # If it's a ring, endpoints is empty. Just pick the original core.
    start_node = endpoints[0] if endpoints else core_id
    
    # Traverse from start_node to build ordered path
    ordered_path = []
    current_node = start_node
    visited_path_cores = set([current_node])
    
    total_attenuation = 0
    
    while True:
        # Fetch current node details
        core = db.query(Core).filter(Core.id == current_node).first()
        cable = core.cable
        
        ordered_path.append({
            "type": "core",
            "core_id": str(core.id),
            "cable_name": cable.name,
            "color": core.color,
            "tube": core.tube_number,
            "status": core.status
        })
        
        # Find next splice
        neighbors = get_neighbors(current_node)
        unvisited_neighbors = [(n, s) for n, s in neighbors if n not in visited_path_cores]
        
        if not unvisited_neighbors:
            break # Reached the other end
            
        next_node, next_splice = unvisited_neighbors[0] # Pick the first unvisited
        
        closure = next_splice.closure
        ordered_path.append({
            "type": "splice",
            "splice_id": str(next_splice.id),
            "closure_name": closure.name if closure else "Unknown",
            "attenuation": next_splice.attenuation
        })
        
        total_attenuation += (next_splice.attenuation or 0)
        
        current_node = next_node
        visited_path_cores.add(current_node)

    return {
        "path": ordered_path,
        "total_attenuation": total_attenuation
    }
