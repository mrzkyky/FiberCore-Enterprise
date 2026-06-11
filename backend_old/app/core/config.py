import os

class Settings:
    PROJECT_NAME: str = "FiberCore Enterprise"
    API_V1_STR: str = "/api/v1"
    
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "fibercore")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "fibercore_password")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "fibercore_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
