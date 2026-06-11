import sys
import os

# Menambahkan path agar bisa membaca folder app/
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import SessionLocal
from app.db.models import User
from app.core.security import get_password_hash

def init_admin():
    db = SessionLocal()
    try:
        # Cek apakah user sudah ada
        user = db.query(User).filter(User.email == "admin@fibercore.local").first()
        if not user:
            new_user = User(
                email="admin@fibercore.local",
                hashed_password=get_password_hash("admin123"),
                full_name="System Administrator",
                role="Super Admin"
            )
            db.add(new_user)
            db.commit()
            print("Berhasil membuat akun: admin@fibercore.local dengan password: admin123")
        else:
            print("Akun admin sudah ada di database.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_admin()
