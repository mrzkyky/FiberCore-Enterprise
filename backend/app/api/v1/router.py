from fastapi import APIRouter
from app.api.v1.endpoints import auth, cables, organizations, pops, devices, splices, analytics, map, uploads, ports

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(cables.router, prefix="/cables", tags=["Cables & Cores"])
api_router.include_router(splices.router, prefix="/splices", tags=["Splices"])
api_router.include_router(map.router, prefix="/map", tags=["map"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(ports.router, prefix="/ports", tags=["ports"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router.include_router(pops.router, prefix="/pops", tags=["Point of Presence"])
api_router.include_router(devices.router, prefix="/devices", tags=["Devices (OLT, OTB, ODP, Closure)"])
