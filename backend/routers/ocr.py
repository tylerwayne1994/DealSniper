from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from pydantic import BaseModel
import base64
from services.ocr_service import ocr_service

router = APIRouter()


class OCRRequest(BaseModel):
    images: List[str]  # Base64 encoded images


class OCRResponse(BaseModel):
    success: bool
    extracted_data: List[dict]
    parsed_data: dict = None
    message: str = None


@router.post("/extract-and-parse", response_model=OCRResponse)
async def extract_and_parse_pages(request: OCRRequest):
    """
    Extract text from PDF page images using Mistral OCR,
    then parse the data using LlamaParse
    """
    try:
        # Step 1: OCR extraction with Mistral
        extracted_data = await ocr_service.extract_text_from_images(request.images)
        
        # Step 2: Parse with LlamaParse
        parsed_data = await ocr_service.parse_extracted_data(extracted_data)
        
        return OCRResponse(
            success=True,
            extracted_data=extracted_data,
            parsed_data=parsed_data,
            message=f"Successfully processed {len(request.images)} pages"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-only", response_model=OCRResponse)
async def extract_text_only(request: OCRRequest):
    """
    Extract text from PDF page images using Mistral OCR only
    """
    try:
        extracted_data = await ocr_service.extract_text_from_images(request.images)
        
        return OCRResponse(
            success=True,
            extracted_data=extracted_data,
            message=f"Successfully extracted text from {len(request.images)} pages"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
