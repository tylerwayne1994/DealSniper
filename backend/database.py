from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite database URL - can be swapped for Postgres later via environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dealsniper.db")

# Create engine - add check_same_thread=False for SQLite
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for ORM models
Base = declarative_base()

# Dependency for FastAPI routes to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
