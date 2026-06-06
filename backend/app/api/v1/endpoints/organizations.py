from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy.orm import Session
from typing import List
from app.db.session import SessionLocal
from app.db.models import Organization
from app.schemas.asset import OrganizationCreate, OrganizationResponse

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=OrganizationResponse)
def create_organization(org_in: OrganizationCreate, db: Session = Depends(get_db)):
    db_org = Organization(**org_in.model_dump())
    db.add(db_org)
    db.commit()
    db.refresh(db_org)
    return db_org

@router.get("/", response_model=List[OrganizationResponse])
def get_organizations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Organization).offset(skip).limit(limit).all()

@router.put("/{org_id}", response_model=OrganizationResponse)
def update_organization(org_id: uuid.UUID, org_in: OrganizationCreate, db: Session = Depends(get_db)):
    db_org = db.query(Organization).filter(Organization.id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    for key, value in org_in.model_dump().items():
        setattr(db_org, key, value)
        
    db.commit()
    db.refresh(db_org)
    return db_org

@router.delete("/{org_id}")
def delete_organization(org_id: uuid.UUID, db: Session = Depends(get_db)):
    db_org = db.query(Organization).filter(Organization.id == org_id).first()
    if not db_org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    db.delete(db_org)
    db.commit()
    return {"message": "Organization deleted successfully"}
