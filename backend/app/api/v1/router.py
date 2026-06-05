from fastapi import APIRouter
from app.api.v1.endpoints import auth, cables, organizations, pops

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(cables.router, prefix="/cables", tags=["Cables & Cores"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router.include_router(pops.router, prefix="/pops", tags=["Point of Presence"])
