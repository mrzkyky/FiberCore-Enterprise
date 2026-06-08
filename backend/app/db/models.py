import uuid
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, func, Boolean
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
    location = Column(Geometry('POINT', spatial_index=False))
    
    organization = relationship("Organization", back_populates="pops")
    devices = relationship("Device", back_populates="pop")

class Cable(Base):
    __tablename__ = "cables"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    capacity = Column(Integer, nullable=False)
    type = Column(String, nullable=False)
    route = Column(Geometry('LINESTRING', spatial_index=False))
    region = Column(String, nullable=True) # E.g., Brebes, Tegal
    import_batch = Column(String, nullable=True) # Identifies which KMZ import this cable came from
    description = Column(String, nullable=True) # Store KMZ descriptions or manual notes
    color = Column(String, nullable=True) # KMZ Hex Color
    length = Column(Float, nullable=True) # Length in meters
    
    cores = relationship("Core", back_populates="cable", cascade="all, delete-orphan")

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
    closure_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=True)
    
    closure = relationship("Device", back_populates="splices")
    core_a = relationship("Core", foreign_keys=[core_a_id])
    core_b = relationship("Core", foreign_keys=[core_b_id])

class Device(Base):
    __tablename__ = "devices"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True)
    device_type = Column(String) # OLT, OTB, ODP, Closure, Pole
    pop_id = Column(UUID(as_uuid=True), ForeignKey("pops.id"), nullable=True)
    location = Column(Geometry('POINT', spatial_index=False), nullable=True)
    capacity = Column(Integer, nullable=True) # Ports for ODP/OLT, Trays for Closure
    used_capacity = Column(Integer, default=0) # Track used ports for OLT/OTB/ODP
    brand = Column(String, nullable=True)
    description = Column(String, nullable=True) # Store KMZ descriptions (slack, spare, etc)
    icon_url = Column(String, nullable=True) # KMZ icon base64 or URL
    region = Column(String, nullable=True) # Automatically assigned during KMZ upload
    import_batch = Column(String, nullable=True) # Identifies which KMZ import this device came from
    created_at = Column(DateTime, default=func.now())
    
    pop = relationship("POP", back_populates="devices")
    splices = relationship("Splice", back_populates="closure")
    ports = relationship("Port", back_populates="device", cascade="all, delete-orphan")

class Port(Base):
    __tablename__ = "ports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)
    port_number = Column(Integer, nullable=False)
    status = Column(String, default="Free") # Free, Connected, Broken
    core_id = Column(UUID(as_uuid=True), ForeignKey("cores.id"), nullable=True) # Core plugged into port
    
    device = relationship("Device", back_populates="ports")
    core = relationship("Core")
    customer = relationship("Customer", back_populates="port", uselist=False)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    service_id = Column(String, unique=True, index=True) # e.g. INET-12345
    address = Column(String, nullable=True)
    port_id = Column(UUID(as_uuid=True), ForeignKey("ports.id"), unique=True, nullable=True)
    
    port = relationship("Port", back_populates="customer")
