from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import uuid
import re
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
    splice_type: Optional[str] = 'straight' # 'straight' | 'petik'
    petik_tube: Optional[str] = None # e.g. "Tube 2 (Oranye)"
    petik_core: Optional[str] = None # e.g. "Core 3 (Hijau)"
    petik_target: Optional[str] = None
    skip_spliced: bool = False # Default False: izinkan sambung langsung & overwrite / koreksi sambungan
    selected_cores_a: Optional[List[int]] = None # List nomor core spesifik di kabel A
    selected_cores_b: Optional[List[int]] = None # List nomor core spesifik di kabel B

TUBE_COLOR_MAP = {
    1: "Biru",
    2: "Oren",
    3: "Hijau",
    4: "Cokelat",
    5: "Abu",
    6: "Putih",
    7: "Merah",
    8: "Hitam",
    9: "Kuning",
    10: "Ungu",
    11: "Pink",
    12: "Toska"
}

def format_tube_label(tube_num: int) -> str:
    color = TUBE_COLOR_MAP.get(tube_num, "")
    return f"Tube {tube_num} ({color})" if color else f"Tube {tube_num}"

def get_core_tube_info(cable_capacity: int, core_number: int):
    cap = cable_capacity or 12
    if cap <= 6:
        return 1, core_number
    elif cap <= 12:
        # Standar Lapangan Indonesia: 12 Core = 2 Tube x 6 Core
        t_num = ((core_number - 1) // 6) + 1
        c_in_t = ((core_number - 1) % 6) + 1
        return t_num, c_in_t
    elif cap <= 24:
        # Standar Lapangan Indonesia: 24 Core = 4 Tube x 6 Core
        t_num = ((core_number - 1) // 6) + 1
        c_in_t = ((core_number - 1) % 6) + 1
        return t_num, c_in_t
    else:
        # 48C, 96C, 144C = 12 Core per Tube
        t_num = ((core_number - 1) // 12) + 1
        c_in_t = ((core_number - 1) % 12) + 1
        return t_num, c_in_t

def sync_all_splice_descriptions(db: Session):
    """
    Menyinkronkan deskripsi semua Joint Closure (JC) dan Kabel (Feeder maupun Dropcore)
    berdasarkan data relasi sambungan fisik (Splice) yang ada di database.
    """
    try:
        from sqlalchemy import func
        # 1. Sync Joint Closures (Devices)
        closures = db.query(Device).filter(
            func.lower(Device.device_type).in_(["closure", "joint closure", "joint box"])
        ).all()

        for cl in closures:
            splices = db.query(Splice).filter(Splice.closure_id == cl.id).all()
            if not splices:
                if cl.description and ("➔" in cl.description or "to" in cl.description or "via" in cl.description or "Sambung" in cl.description):
                    cl.description = None
                continue

            # Urutkan berdasarkan nomor core kabel feeder
            def get_feeder_core_num(sp):
                ca = sp.core_a
                cb = sp.core_b
                if not ca or not cb or not ca.cable or not cb.cable:
                    return 999999
                if (cb.cable.capacity or 0) >= (ca.cable.capacity or 0):
                    return cb.core_number or 0
                return ca.core_number or 0

            splices = sorted(splices, key=get_feeder_core_num)

            lines = []
            for sp in splices:
                ca = sp.core_a
                cb = sp.core_b
                if not ca or not cb or not ca.cable or not cb.cable:
                    continue

                # Tentukan feeder (kapasitas lebih besar) dan drop
                if (cb.cable.capacity or 0) >= (ca.cable.capacity or 0):
                    feeder_c, feeder_core = cb.cable, cb
                    drop_c, drop_core = ca.cable, ca
                else:
                    feeder_c, feeder_core = ca.cable, ca
                    drop_c, drop_core = cb.cable, cb

                t_num, c_in_t = get_core_tube_info(feeder_c.capacity, feeder_core.core_number)
                t_lbl = format_tube_label(t_num)
                dest_info = f" (Core {drop_core.core_number})" if (drop_c.capacity or 0) > 2 else ""
                entry = f"[{feeder_c.name}] {t_lbl} / Core {c_in_t} ({feeder_core.color}) ➔ {drop_c.name}{dest_info}"
                if entry not in lines:
                    lines.append(entry)

            if lines:
                cl.description = " | ".join(lines)
            else:
                if cl.description and ("➔" in cl.description or "to" in cl.description or "via" in cl.description or "Sambung" in cl.description):
                    cl.description = None

        # 2. Sync Cables (Feeder/Distribution dan Dropcore)
        cables = db.query(Cable).all()
        for cable in cables:
            cable_cores = db.query(Core).filter(Core.cable_id == cable.id).all()
            core_ids = [c.id for c in cable_cores]
            if not core_ids:
                continue

            splices = db.query(Splice).filter(
                (Splice.core_a_id.in_(core_ids)) | (Splice.core_b_id.in_(core_ids))
            ).all()

            if not splices:
                if cable.description and ("➔" in cable.description or "to" in cable.description or "via" in cable.description or "Sambung" in cable.description or "[Pelebaran" in cable.description):
                    cable.description = None
                continue

            # Urutkan berdasarkan nomor core kabel ini
            def get_cable_core_num(sp):
                ca = sp.core_a
                cb = sp.core_b
                if not ca or not cb:
                    return 999999
                c = ca if ca.cable_id == cable.id else cb
                return c.core_number or 0

            splices = sorted(splices, key=get_cable_core_num)

            lines = []
            is_feeder = (cable.capacity or 0) > 4

            for sp in splices:
                ca = sp.core_a
                cb = sp.core_b
                if not ca or not cb or not ca.cable or not cb.cable:
                    continue

                this_core = ca if ca.cable_id == cable.id else cb
                other_core = cb if ca.cable_id == cable.id else ca
                other_cable = other_core.cable
                cl_name = sp.closure.name if sp.closure else "JC"

                if is_feeder:
                    t_num, c_in_t = get_core_tube_info(cable.capacity, this_core.core_number)
                    t_lbl = format_tube_label(t_num)
                    dest_info = f" (Core {other_core.core_number})" if (other_cable.capacity or 0) > 2 else ""
                    item = f"via {cl_name}: {t_lbl} / Core {c_in_t} ({this_core.color}) ➔ {other_cable.name}{dest_info}"
                else:
                    t_num, oc_in_t = get_core_tube_info(other_cable.capacity, other_core.core_number)
                    ot_lbl = format_tube_label(t_num)
                    item = f"Sambung ke {other_cable.name} via {cl_name} ({ot_lbl} / Core {oc_in_t} ({other_core.color}))"

                if item not in lines:
                    lines.append(item)

            if lines:
                cable.description = " | ".join(lines)
            else:
                if cable.description and ("➔" in cable.description or "to" in cable.description or "via" in cable.description or "Sambung" in cable.description or "[Pelebaran" in cable.description):
                    cable.description = None

        db.commit()
    except Exception as e:
        print(f"Error syncing splice descriptions: {e}")

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

    cores_a = db.query(Core).filter(Core.cable_id == cable_a.id).order_by(Core.tube_number, Core.core_number).all()
    cores_b = db.query(Core).filter(Core.cable_id == cable_b.id).order_by(Core.tube_number, Core.core_number).all()

    closure = None
    if payload.closure_id:
        closure = db.query(Device).filter(Device.id == payload.closure_id).first()
    
    if not closure:
        # Intelligently find the closest Joint Closure / Closure / ODP
        target_region = cable_b.region or cable_a.region
        cand_query = db.query(Device).filter(
            func.lower(Device.device_type).in_(["closure", "joint closure", "joint box", "odp"])
        )
        if target_region:
            cand_region = cand_query.filter(Device.region == target_region)
            if cand_region.count() > 0:
                cand_query = cand_region
        
        # Order by spatial distance to cable_a or cable_b
        try:
            if cable_a.route is not None:
                cand_query = cand_query.order_by(func.ST_Distance(Device.location, cable_a.route))
            elif cable_b.route is not None:
                cand_query = cand_query.order_by(func.ST_Distance(Device.location, cable_b.route))
        except Exception:
            pass
            
        closure = cand_query.first()
        if not closure:
            closure = Device(
                name=f"JC-{cable_a.name[:8]}-{cable_b.name[:8]}",
                device_type="Joint Closure",
                region=target_region,
                capacity=48,
                description="Titik Sambungan / Joint Closure"
            )
            db.add(closure)
            db.commit()
            db.refresh(closure)

    spliced_count = 0
    splice_details = []

    # Auto-calculate core index HANYA jika mode Petik
    if payload.splice_type == 'petik':
        payload.skip_spliced = False # Mode petik tidak boleh skip core yang dipilih user
        tube_match = re.search(r'\d+', payload.petik_tube or '')
        core_match = re.search(r'\d+', payload.petik_core or '')
        t_num = int(tube_match.group()) if tube_match else 1
        c_num = int(core_match.group()) if core_match else 1
        # Deteksi otomatis kabel mana yang Feeder (kapasitas lebih besar) dan mana yang Dropcore
        feeder_abs_core = (t_num - 1) * 12 + c_num
        if (cable_a.capacity or 0) >= (cable_b.capacity or 0):
            # cable_a adalah Feeder (misal 48 CORE / 12 CORE), cable_b adalah Dropcore (misal 2C)
            payload.start_core_a = feeder_abs_core
            payload.start_core_b = 1
        else:
            # cable_b adalah Feeder, cable_a adalah Dropcore
            payload.start_core_b = feeder_abs_core
            payload.start_core_a = 1

        payload.count = 1
        if not payload.custom_note:
            target_str = f" - {payload.petik_target}" if payload.petik_target else ""
            payload.custom_note = f"{payload.petik_tube} / {payload.petik_core}{target_str}"

    core_pairs = []
    if payload.selected_cores_a and payload.selected_cores_b:
        # Mode Custom Checklist: Sambungkan pasangan nomor core yang dipilih
        for num_a, num_b in zip(payload.selected_cores_a, payload.selected_cores_b):
            idx_a = num_a - 1
            idx_b = num_b - 1
            if 0 <= idx_a < len(cores_a) and 0 <= idx_b < len(cores_b):
                core_pairs.append((cores_a[idx_a], cores_b[idx_b]))
    else:
        # Validate start core indices
        if payload.start_core_a > len(cores_a):
            raise HTTPException(
                status_code=400,
                detail=f"Start Core A ({payload.start_core_a}) melebihi kapasitas kabel '{cable_a.name}' yang hanya memiliki {len(cores_a)} core. Gunakan Core 1 s/d {len(cores_a)}."
            )
        if payload.start_core_b > len(cores_b):
            raise HTTPException(
                status_code=400,
                detail=f"Start Core B ({payload.start_core_b}) melebihi kapasitas kabel '{cable_b.name}' yang hanya memiliki {len(cores_b)} core. Gunakan Core 1 s/d {len(cores_b)}."
            )

        for i in range(payload.count):
            idx_a = payload.start_core_a - 1 + i
            idx_b = payload.start_core_b - 1 + i
            if idx_a >= len(cores_a) or idx_b >= len(cores_b):
                break
            core_pairs.append((cores_a[idx_a], cores_b[idx_b]))

    skipped_count = 0
    for ca, cb in core_pairs:
        # Jika opsi skip_spliced aktif dan core ini sudah memiliki sambungan lain:
        if payload.skip_spliced and payload.splice_type != 'petik':
            other_splice_query = db.query(Splice).filter(
                ((Splice.core_a_id == ca.id) & (Splice.core_b_id != cb.id)) |
                ((Splice.core_b_id == ca.id) & (Splice.core_a_id != cb.id)) |
                ((Splice.core_a_id == cb.id) & (Splice.core_b_id != ca.id)) |
                ((Splice.core_b_id == cb.id) & (Splice.core_a_id != ca.id))
            )
            if closure:
                other_splice_query = other_splice_query.filter(Splice.closure_id == closure.id)
            other_splice = other_splice_query.first()
            if other_splice:
                skipped_count += 1
                continue

        # Bersihkan splice lama jika core ca atau cb sudah pernah tersambung ke core lain (koreksi sambungan / overwrite)
        old_splices_query = db.query(Splice).filter(
            (Splice.core_a_id.in_([ca.id, cb.id])) | (Splice.core_b_id.in_([ca.id, cb.id]))
        )
        old_splices = old_splices_query.all()

        for old_sp in old_splices:
            # Lewati jika sudah merupakan splice antara ca dan cb
            if (old_sp.core_a_id == ca.id and old_sp.core_b_id == cb.id) or (old_sp.core_a_id == cb.id and old_sp.core_b_id == ca.id):
                continue
            # Bebaskan core seberang yang dilepas
            other_id = old_sp.core_b_id if old_sp.core_a_id in (ca.id, cb.id) else old_sp.core_a_id
            other_core = db.query(Core).filter(Core.id == other_id).first()
            if other_core:
                other_core.status = "Free"
            db.delete(old_sp)

        # Cek apakah sudah tersambung antara ca dan cb di closure ini
        existing_query = db.query(Splice).filter(
            ((Splice.core_a_id == ca.id) & (Splice.core_b_id == cb.id)) |
            ((Splice.core_a_id == cb.id) & (Splice.core_b_id == ca.id))
        )
        if closure:
            existing_query = existing_query.filter(Splice.closure_id == closure.id)
        existing = existing_query.first()

        if existing:
            if closure:
                existing.closure_id = closure.id
            if payload.attenuation is not None:
                existing.attenuation = payload.attenuation
            ca.status = "Spliced"
            cb.status = "Spliced"
            spliced_count += 1
            splice_details.append(f"C{ca.core_number}({ca.color}) <-> C{cb.core_number}({cb.color})")
        else:
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
        already_spliced = sum(1 for c in cores_a if c.status == "Spliced")
        raise HTTPException(
            status_code=400,
            detail=f"Tidak ada core yang berhasil disambungkan (semua {len(core_pairs)} core terpilih dilewati karena sudah memiliki sambungan). "
                   f"Hilangkan centang 'Otomatis lewati (skip) core' jika Anda ingin menimpa atau memperbarui sambungan kabel ini."
        )

    if payload.auto_update_description:
        closure_label = closure.name if closure else "JC"
        is_petik = bool(payload.splice_type == 'petik')
        
        if is_petik:
            # Format Simpel & Bersih untuk Sambungan Petik (ODP/Dropcore)
            detail = payload.custom_note
            if (cable_a.capacity or 0) >= (cable_b.capacity or 0):
                feeder_c, drop_c = cable_a, cable_b
                note_for_a = f"via {closure_label}: {detail} ➔ {drop_c.name}"
                note_for_b = f"Sambung ke {feeder_c.name} via {closure_label} ({detail})"
                jc_entry = f"[{feeder_c.name}] {detail} ➔ {drop_c.name}"
            else:
                feeder_c, drop_c = cable_b, cable_a
                note_for_a = f"Sambung ke {feeder_c.name} via {closure_label} ({detail})"
                note_for_b = f"via {closure_label}: {detail} ➔ {drop_c.name}"
                jc_entry = f"[{feeder_c.name}] {detail} ➔ {drop_c.name}"
        else:
            # Format Simpel & Bersih untuk Pelebaran Lurus (Trunk / Multi-Core)
            core_info_a = f"Core {payload.start_core_a}" if payload.count == 1 else f"Core {payload.start_core_a}-{payload.start_core_a + spliced_count - 1}"
            core_info_b = f"Core {payload.start_core_b}" if payload.count == 1 else f"Core {payload.start_core_b}-{payload.start_core_b + spliced_count - 1}"
            extra = f" - {payload.custom_note}" if payload.custom_note else ""
            
            note_for_a = f"Sambung ke {cable_b.name} via {closure_label} ({core_info_a}){extra}"
            note_for_b = f"Sambung dari {cable_a.name} via {closure_label} ({core_info_b}){extra}"
            jc_entry = f"{cable_a.name} ({core_info_a}) ➔ {cable_b.name} ({core_info_b}){extra}"

        # 1. Update Joint Closure
        if closure:
            if not closure.description:
                closure.description = jc_entry
            elif jc_entry not in closure.description:
                closure.description = f"{closure.description} | {jc_entry}"

        # 2. Update Cable Descriptions (cegah duplikat)
        if not cable_a.description:
            cable_a.description = note_for_a
        elif note_for_a not in cable_a.description:
            cable_a.description = f"{cable_a.description} | {note_for_a}"

        if not cable_b.description:
            cable_b.description = note_for_b
        elif note_for_b not in cable_b.description:
            cable_b.description = f"{cable_b.description} | {note_for_b}"

    # Update hitungan used_capacity di kedua kabel secara akurat
    cable_a.used_capacity = db.query(Core).filter(Core.cable_id == cable_a.id, Core.status == "Spliced").count()
    cable_b.used_capacity = db.query(Core).filter(Core.cable_id == cable_b.id, Core.status == "Spliced").count()

    db.commit()

    # Otomatis sinkronkan deskripsi semua kabel dan JC terkait dari data splice fisik
    sync_all_splice_descriptions(db)
    db.refresh(cable_a)
    db.refresh(cable_b)

    skip_msg = f" (otomatis melewati {skipped_count} core yang sudah dipetik/tersambung)" if skipped_count > 0 else ""
    return {
        "message": f"Berhasil menyambungkan {spliced_count} core antara '{cable_a.name}' dan '{cable_b.name}'{skip_msg}",
        "spliced_count": spliced_count,
        "skipped_count": skipped_count,
        "closure_name": closure.name if closure else None,
        "details": splice_details,
        "description_a": cable_a.description,
        "description_b": cable_b.description
    }

@router.post("/sync-descriptions")
@router.get("/sync-descriptions")
def trigger_sync_descriptions(db: Session = Depends(get_db)):
    """Sinkronkan ulang seluruh deskripsi JC dan kabel dari data tabel Splice."""
    sync_all_splice_descriptions(db)
    return {"message": "Semua deskripsi Joint Closure dan Kabel berhasil disinkronkan dari data Splice."}

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
        core_in_tube = ((core.core_number - 1) % 12) + 1
        return {
            "path": [{
                "type": "core",
                "core_id": str(core.id),
                "cable_name": cable.name,
                "cable_type": cable.type,
                "cable_capacity": cable.capacity,
                "color": core.color,
                "tube": core.tube_number,
                "core_number": core.core_number,
                "core_in_tube": core_in_tube,
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
        
        core_in_tube = ((core.core_number - 1) % 12) + 1
        ordered_path.append({
            "type": "core",
            "core_id": str(core.id),
            "cable_name": cable.name,
            "cable_type": cable.type,
            "cable_capacity": cable.capacity,
            "color": core.color,
            "tube": core.tube_number,
            "core_number": core.core_number,
            "core_in_tube": core_in_tube,
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
