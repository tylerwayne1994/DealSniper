"""
Image Storage Module - Handles uploading extracted images to Supabase Storage
"""
import os
from supabase import create_client, Client
from typing import List, Dict, Any

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_supabase_client() -> Client:
    """Get Supabase client with service role key"""
    if not SUPABASE_SERVICE_KEY:
        raise ValueError("SUPABASE_SERVICE_KEY not set in environment")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def upload_images_to_supabase(deal_id: str, images: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Upload extracted images to Supabase Storage
    
    Args:
        deal_id: Unique identifier for the deal
        images: List of image dicts with filepath, filename, page_number, etc.
        
    Returns:
        List of uploaded image metadata with public URLs
    """
    supabase = get_supabase_client()
    bucket_name = "deal-images"
    uploaded_images = []
    
    for img in images:
        try:
            file_path = img["filepath"]
            storage_path = f"{deal_id}/{img['filename']}"
            
            # Read image bytes
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            
            # Upload to Supabase Storage
            supabase.storage.from_(bucket_name).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": f"image/{img['format']}", "upsert": "true"}
            )
            
            # Get public URL
            public_url = supabase.storage.from_(bucket_name).get_public_url(storage_path)
            
            uploaded_images.append({
                "filename": img["filename"],
                "url": public_url,
                "page_number": img["page_number"],
                "storage_path": storage_path,
                "size_bytes": img["size_bytes"],
                "format": img["format"]
            })
            
            # Clean up temporary file
            try:
                os.remove(file_path)
            except:
                pass
                
        except Exception as e:
            print(f"Error uploading image {img['filename']}: {str(e)}")
            continue
    
    return uploaded_images
