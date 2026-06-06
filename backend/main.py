from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.db.session import engine
from app.db.models import Base
from sqlalchemy import text

app = FastAPI(title="FiberCore Enterprise API")

@app.on_event("startup")
def on_startup():
    # Auto-create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Auto-migrate new columns
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE cables ADD COLUMN IF NOT EXISTS region VARCHAR;"))
            conn.execute(text("ALTER TABLE cables ADD COLUMN IF NOT EXISTS import_batch VARCHAR;"))
        except Exception as e:
            print(f"Migration error: {e}")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev
    allow_credentials=False, # Must be False if allow_origins is ["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to FiberCore Enterprise API", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
