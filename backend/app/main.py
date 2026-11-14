from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
import app.models.user # Ensure models are loaded

app = FastAPI(
    title="FiberCore EOMS API",
    description="Engineering Operations Management System API",
    version="1.0.0"
)

# Auto-create tables on startup
@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Database table initialization error: {e}")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=False, # Must be False if allow_origins is ["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to FiberCore EOMS API", "status": "running"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/v1")
def api_v1_root():
    return {"message": "FiberCore API v1"}
