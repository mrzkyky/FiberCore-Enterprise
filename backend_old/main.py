from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.db.session import engine
from app.db.models import Base
from app.scripts.init_admin import init_admin
from sqlalchemy import text

app = FastAPI(title="FiberCore Enterprise API", redirect_slashes=False)

@app.on_event("startup")
def on_startup():
    # 1. Enable PostGIS extension and fix legacy users table
    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            print("PostGIS extension enabled.")
        except Exception as e:
            print(f"PostGIS extension error: {e}")

        try:
            col_type = conn.execute(text("""
                SELECT data_type FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'id';
            """)).scalar()
            if col_type and 'uuid' not in col_type.lower():
                print("Replacing incompatible legacy users table with UUID version...")
                conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        except Exception as e:
            print(f"Users table check error: {e}")

    # 2. Auto-create tables if they don't exist
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully.")
    except Exception as e:
        print(f"Table creation error: {e}")
    
    # 3. Auto-migrate new columns
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE cables ADD COLUMN IF NOT EXISTS region VARCHAR;"))
            conn.execute(text("ALTER TABLE cables ADD COLUMN IF NOT EXISTS import_batch VARCHAR;"))
            conn.execute(text("ALTER TABLE cables ADD COLUMN IF NOT EXISTS description VARCHAR;"))
            conn.execute(text("ALTER TABLE cables ADD COLUMN IF NOT EXISTS line_width FLOAT DEFAULT 3.0;"))
            conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS description VARCHAR;"))
            conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS used_capacity INTEGER DEFAULT 0;"))
            conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS icon_url VARCHAR;"))
            conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS import_batch VARCHAR;"))
            
            # Auto-fix: Correct core_number for multi-tube cables (e.g., 48C where core_number was previously wrapped 1..12)
            conn.execute(text("""
                UPDATE cores 
                SET core_number = (tube_number - 1) * 12 + ((core_number - 1) % 12) + 1
                WHERE tube_number > 1 AND core_number <= 12;
            """))
            print("Cores numbering migration applied successfully.")

            # Standarisasi Bahasa Warna Core Lapangan:
            # Biru, Oren, Hijau, Cokelat, Abu, Putih, Merah, Hitam, Kuning, Ungu, Pink, Toska
            color_updates = {
                "Blue": "Biru",
                "Orange": "Oren",
                "Oranye": "Oren",
                "Green": "Hijau",
                "Brown": "Cokelat",
                "Coklat": "Cokelat",
                "Slate": "Abu",
                "Abu-abu": "Abu",
                "White": "Putih",
                "Red": "Merah",
                "Black": "Hitam",
                "Yellow": "Kuning",
                "Violet": "Ungu",
                "Rose": "Pink",
                "Aqua": "Toska",
                "Tosca": "Toska"
            }
            for old_c, new_c in color_updates.items():
                conn.execute(text(f"UPDATE cores SET color = '{new_c}' WHERE color = '{old_c}';"))
            print("Cores color standard normalization applied successfully.")
        except Exception as e:
            print(f"Migration error: {e}")

    # 4. Auto-create default admin account
    try:
        init_admin()
    except Exception as e:
        print(f"Admin init error: {e}")

    # 5. Auto-sync descriptions for all Joint Closures & Cables from actual splices
    try:
        from app.db.session import SessionLocal
        from app.api.v1.endpoints.splices import sync_all_splice_descriptions
        db_session = SessionLocal()
        try:
            sync_all_splice_descriptions(db_session)
            print("Auto-synced all Joint Closure & Cable splice descriptions.")
        finally:
            db_session.close()
    except Exception as e:
        print(f"Splice descriptions auto-sync error: {e}")

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

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8086, reload=True)
