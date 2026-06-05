import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, func, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from .base import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="Viewer") # Super Admin, Infra Manager, Fiber Engineer, Viewer
    is_active = Column(Boolean, default=True)

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    level = Column(String, nullable=False) # Region, Area, Branch, Cluster
    parent_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    
    parent = relationship("Organization", remote_side=[id], backref="children")
    pops = relationship("POP", back_populates="organization")

class POP(Base):
    __tablename__ = "pops"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    location = Column(Geometry('POINT'))
    
    organization = relationship("Organization", back_populates="pops")
    assets = relationship("Asset", back_populates="pop")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String, nullable=False) # OTB, ODP, Closure, OLT
    status = Column(String, nullable=False)
    location = Column(Geometry('POINT'))
    pop_id = Column(UUID(as_uuid=True), ForeignKey("pops.id"), nullable=True)
    
    pop = relationship("POP", back_populates="assets")
    splices = relationship("Splice", back_populates="closure")

class Cable(Base):
    __tablename__ = "cables"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    capacity = Column(Integer, nullable=False)
    type = Column(String, nullable=False)
    route = Column(Geometry('LINESTRING'))
    
    cores = relationship("Core", back_populates="cable")

class Core(Base):
    __tablename__ = "cores"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cable_id = Column(UUID(as_uuid=True), ForeignKey("cables.id"))
    core_number = Column(Integer, nullable=False)
    tube_number = Column(Integer, nullable=False)
    color = Column(String, nullable=False)
    status = Column(String, nullable=False, default="Free")
    
    cable = relationship("Cable", back_populates="cores")

class Splice(Base):
    __tablename__ = "splices"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    core_a_id = Column(UUID(as_uuid=True), ForeignKey("cores.id"))
    core_b_id = Column(UUID(as_uuid=True), ForeignKey("cores.id"))
    attenuation = Column(Integer) # dB loss
    created_at = Column(DateTime, default=func.now())

class Device(Base):
    __tablename__ = "devices"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True)
    device_type = Column(String) # OLT, OTB, ODP, Closure
    pop_id = Column(UUID(as_uuid=True), ForeignKey("pops.id"), nullable=True)
    location = Column(Geometry('POINT'), nullable=True)
    capacity = Column(Integer, nullable=True) # Ports for ODP/OLT, Trays for Closure
    brand = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    closure = relationship("Asset", back_populates="splices")
    in_core = relationship("Core", foreign_keys=[in_core_id])
    out_core = relationship("Core", foreign_keys=[out_core_id])
