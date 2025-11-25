from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import deals, ocr
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="DealSniper API",
    description="Investment property underwriting and pipeline management",
    version="1.0.0"
)

# CORS middleware to allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(deals.router)
app.include_router(ocr.router, prefix="/api/ocr", tags=["ocr"])

# Health check endpoint
@app.get("/")
def root():
    return {"message": "DealSniper API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
