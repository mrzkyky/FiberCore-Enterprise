from fastapi import APIRouter, Depends
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
