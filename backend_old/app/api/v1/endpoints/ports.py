from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from pydantic import BaseModel
from app.db.session import SessionLocal
from app.db.models import Device, Port, Core, Customer

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class PortCreate(BaseModel):
    device_id: str
    port_number: int

class PortPatch(BaseModel):
    core_id: str

class CustomerCreate(BaseModel):
    name: str
    service_id: str
    address: str
    port_id: str

@router.get("/device/{device_id}")
def get_device_ports(device_id: str, db: Session = Depends(get_db)):
    # Auto-generate ports if ODP or OLT based on capacity
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    ports = db.query(Port).filter(Port.device_id == device_id).order_by(Port.port_number).all()
    
    # Generate ports if they don't exist and device has capacity
    if not ports and device.capacity and device.capacity > 0:
        new_ports = []
        for i in range(1, device.capacity + 1):
            new_ports.append(Port(device_id=device_id, port_number=i))
        db.bulk_save_objects(new_ports)
        db.commit()
        ports = db.query(Port).filter(Port.device_id == device_id).order_by(Port.port_number).all()
        
    # Return ports with customer and core data
    result = []
    for p in ports:
        core_data = None
        if p.core_id:
            core = db.query(Core).filter(Core.id == p.core_id).first()
            if core:
                core_data = {
                    "id": str(core.id),
                    "core_number": core.core_number,
                    "tube_number": core.tube_number,
                    "color": core.color,
                    "cable_name": core.cable.name if core.cable else "Unknown Cable"
                }
                
        cust_data = None
        if p.customer:
            cust_data = {
                "id": str(p.customer.id),
                "name": p.customer.name,
                "service_id": p.customer.service_id
            }
            
        result.append({
            "id": str(p.id),
            "port_number": p.port_number,
            "status": p.status,
            "core": core_data,
            "customer": cust_data
        })
    return result

@router.post("/{port_id}/patch")
def patch_core_to_port(port_id: str, patch_data: PortPatch, db: Session = Depends(get_db)):
    port = db.query(Port).filter(Port.id == port_id).first()
    if not port:
        raise HTTPException(status_code=404, detail="Port not found")
        
    core = db.query(Core).filter(Core.id == patch_data.core_id).first()
    if not core:
        raise HTTPException(status_code=404, detail="Core not found")
        
    # Update Port and Core Status
    port.core_id = core.id
    if port.status == "Free":
        port.status = "Connected"
        
    core.status = "Used"
    
    # Update device used_capacity
    device = db.query(Device).filter(Device.id == port.device_id).first()
    if device:
        device.used_capacity = db.query(Port).filter(Port.device_id == device.id, Port.core_id != None).count() + 1
    
    db.commit()
    return {"message": "Core successfully patched to port"}

@router.post("/{port_id}/unpatch")
def unpatch_core(port_id: str, db: Session = Depends(get_db)):
    port = db.query(Port).filter(Port.id == port_id).first()
    if not port:
        raise HTTPException(status_code=404, detail="Port not found")
        
    if port.core_id:
        core = db.query(Core).filter(Core.id == port.core_id).first()
        if core:
            core.status = "Free"
    
    port.core_id = None
    if not port.customer:
        port.status = "Free"
        
    # Update device used_capacity
    device = db.query(Device).filter(Device.id == port.device_id).first()
    if device:
        current_used = db.query(Port).filter(Port.device_id == device.id, Port.core_id != None).count()
        device.used_capacity = max(0, current_used - 1)
        
    db.commit()
    return {"message": "Core unpatched successfully"}

@router.post("/customer")
def assign_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    port = db.query(Port).filter(Port.id == data.port_id).first()
    if not port:
        raise HTTPException(status_code=404, detail="Port not found")
        
    customer = Customer(
        name=data.name,
        service_id=data.service_id,
        address=data.address,
        port_id=data.port_id
    )
    db.add(customer)
    port.status = "In Use (Customer)"
    db.commit()
    return {"message": "Customer assigned to port"}

@router.delete("/customer/{customer_id}")
def remove_customer(customer_id: str, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    port = customer.port
    db.delete(customer)
    
    if port:
        port.status = "Connected" if port.core_id else "Free"
        
    db.commit()
    return {"message": "Customer removed"}
