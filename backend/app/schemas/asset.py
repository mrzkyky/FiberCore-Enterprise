from pydantic import BaseModel
from typing import Optional, List
import uuid

class OrganizationBase(BaseModel):
    name: str
    level: str # Region, Area, Branch, Cluster
    parent_id: Optional[uuid.UUID] = None

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationResponse(OrganizationBase):
    id: uuid.UUID

    class Config:
        from_attributes = True

class POPBase(BaseModel):
    name: str
    org_id: uuid.UUID

class POPCreate(POPBase):
    pass

class POPResponse(POPBase):
    id: uuid.UUID

    class Config:
        from_attributes = True

class CableBase(BaseModel):
    name: str
    capacity: int
    type: str

class CableCreate(CableBase):
    pass

class CableResponse(CableBase):
    id: uuid.UUID

    class Config:
        from_attributes = True

class CoreResponse(BaseModel):
    id: uuid.UUID
    cable_id: uuid.UUID
    core_number: int
    tube_number: int
    color: str
    status: str

    class Config:
        from_attributes = True
