from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List
import base64
import io
from pdf2image import convert_from_bytes
from PIL import Image

router = APIRouter(prefix="/upload", tags=["upload"])

@router.post("/extract-pdf-pages")
async def extract_pdf_pages(file: UploadFile = File(...)):
    """
    Extract pages from PDF and return as base64 encoded images
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Read PDF file
        pdf_bytes = await file.read()
        
        # Convert PDF pages to images
        images = convert_from_bytes(pdf_bytes, dpi=150)
        
        pages = []
        for i, image in enumerate(images):
            # Resize image to thumbnail size
            thumbnail_size = (300, 400)
            image.thumbnail(thumbnail_size, Image.Resampling.LANCZOS)
            
            # Convert to base64
            buffered = io.BytesIO()
            image.save(buffered, format="JPEG", quality=85)
            img_base64 = base64.b64encode(buffered.getvalue()).decode()
            
            pages.append({
                "page_number": i + 1,
                "thumbnail": f"data:image/jpeg;base64,{img_base64}"
            })
        
        return {
            "filename": file.filename,
            "total_pages": len(pages),
            "pages": pages
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
