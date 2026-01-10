# Image Extraction & Pitch Deck Implementation Plan

## Overview
Extract images from uploaded OM PDFs, store them in Supabase Storage, link them to deals, and use them for pitch deck generation.

---

## Phase 1: Image Extraction from PDFs

### 1.1 Backend: Extract Images During Parsing

**File to Modify:** `backend/parser_v4.py`

**New Method to Add:**
```python
def extract_images_from_pdf(self, file_path: str, output_dir: str) -> List[Dict[str, Any]]:
    """
    Extract images from PDF using PyMuPDF (fitz)
    Returns list of extracted image metadata
    """
    import fitz  # PyMuPDF
    import hashlib
    
    images = []
    pdf_document = fitz.open(file_path)
    
    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        image_list = page.get_images(full=True)
        
        for img_index, img in enumerate(image_list):
            xref = img[0]
            base_image = pdf_document.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            
            # Generate unique filename using hash
            image_hash = hashlib.md5(image_bytes).hexdigest()
            filename = f"page_{page_num + 1}_img_{img_index + 1}_{image_hash}.{image_ext}"
            filepath = os.path.join(output_dir, filename)
            
            # Save image temporarily
            with open(filepath, "wb") as img_file:
                img_file.write(image_bytes)
            
            images.append({
                "filename": filename,
                "filepath": filepath,
                "page_number": page_num + 1,
                "image_index": img_index + 1,
                "format": image_ext,
                "size_bytes": len(image_bytes),
                "hash": image_hash
            })
    
    pdf_document.close()
    return images
```

**Dependencies to Add:**
```bash
pip install PyMuPDF
```

### 1.2 Backend: Upload Images to Supabase Storage

**New File:** `backend/image_storage.py`

```python
import os
from supabase import create_client, Client
from typing import List, Dict, Any

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def upload_images_to_supabase(deal_id: str, images: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Upload extracted images to Supabase Storage
    Returns list of uploaded image URLs
    """
    bucket_name = "deal-images"
    uploaded_images = []
    
    for img in images:
        file_path = img["filepath"]
        storage_path = f"{deal_id}/{img['filename']}"
        
        # Read image bytes
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        
        # Upload to Supabase Storage
        result = supabase.storage.from_(bucket_name).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": f"image/{img['format']}"}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(bucket_name).get_public_url(storage_path)
        
        uploaded_images.append({
            "filename": img["filename"],
            "url": public_url,
            "page_number": img["page_number"],
            "storage_path": storage_path,
            "size_bytes": img["size_bytes"]
        })
        
        # Clean up temporary file
        os.remove(file_path)
    
    return uploaded_images
```

---

## Phase 2: Database Schema Updates

### 2.1 Create Supabase Storage Bucket

**Run in Supabase Dashboard:**
1. Go to Storage
2. Create new bucket: `deal-images`
3. Set to **Public** (so images can be displayed)
4. Add RLS policies:
   - Allow authenticated users to upload
   - Allow public read access

### 2.2 Add Images Column to Deals Table

**New Migration File:** `backend/migrations/add_images_column.sql`

```sql
-- Add images column to deals table
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_deals_images ON deals USING GIN (images);

-- Add comment
COMMENT ON COLUMN deals.images IS 'Array of image URLs extracted from deal OM PDF';
```

**Image JSON Structure:**
```json
[
  {
    "filename": "page_1_img_1_abc123.jpg",
    "url": "https://ylvnrtbkpsnpgskbkbyy.supabase.co/storage/v1/object/public/deal-images/deal-uuid/page_1_img_1_abc123.jpg",
    "page_number": 1,
    "storage_path": "deal-uuid/page_1_img_1_abc123.jpg",
    "size_bytes": 245678
  }
]
```

---

## Phase 3: Backend Integration

### 3.1 Modify Upload Endpoint

**File:** `backend/App.py`

**Update `/parse_om` endpoint:**

```python
@app.post("/parse_om")
async def parse_om(
    file: UploadFile = File(...),
    mode: str = Form("underwriting")
):
    # ... existing code ...
    
    # NEW: Extract images from PDF
    temp_dir = f"temp_images_{deal_id}"
    os.makedirs(temp_dir, exist_ok=True)
    
    extracted_images = _RE_PARSER.extract_images_from_pdf(temp_file_path, temp_dir)
    
    # Upload to Supabase Storage
    from image_storage import upload_images_to_supabase
    uploaded_images = upload_images_to_supabase(deal_id, extracted_images)
    
    # Clean up temp directory
    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)
    
    # Add images to response
    result["images"] = uploaded_images
    result["image_count"] = len(uploaded_images)
    
    return result
```

---

## Phase 4: Frontend Integration

### 4.1 Update Deal Save Function

**File:** `client/src/lib/dealsService.js`

**Update `saveDeal` function:**

```javascript
export async function saveDeal(dealData) {
  const {
    dealId,
    // ... existing fields ...
    images,  // NEW: Array of image objects
  } = dealData;

  const dealRecord = {
    deal_id: dealId,
    // ... existing fields ...
    images: images || [],  // NEW: Store images array
    pipeline_status: 'pipeline',
    updated_at: new Date().toISOString()
  };
  
  // ... rest of save logic ...
}
```

### 4.2 Display Images in Results Page

**File:** `client/src/components/ResultsPageV2.jsx`

**Add new tab for Property Photos:**

```javascript
const tabs = [
  { id: 'overview', label: 'Deal Overview', icon: LayoutDashboard },
  { id: 'photos', label: 'Property Photos', icon: Camera },  // NEW
  { id: 'financials', label: 'Financial Analysis', icon: DollarSign },
  // ... rest of tabs
];

// NEW: Render Photos Tab
const renderPhotosTab = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
    {(data?.images || []).map((img, idx) => (
      <div key={idx} style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff'
      }}>
        <img 
          src={img.url} 
          alt={`Property Photo ${idx + 1}`}
          style={{ width: '100%', height: 250, objectFit: 'cover' }}
        />
        <div style={{ padding: 12 }}>
          <p style={{ fontSize: 12, color: '#6b7280' }}>
            Page {img.page_number} • {img.filename}
          </p>
        </div>
      </div>
    ))}
  </div>
);
```

### 4.3 Update Pipeline Page Actions

**File:** `client/src/pages/PipelinePage.js`

**Add Pitch Deck button next to Due Diligence:**

```javascript
{/* Actions Column */}
<td style={tdStyle}>
  <div style={{ display: 'flex', gap: 8 }}>
    {/* Existing Due Diligence Button */}
    <button
      onClick={() => navigate(`/due-diligence?dealId=${deal.dealId}`)}
      style={actionButtonStyle}
      title="Due Diligence Checklist"
    >
      <ClipboardCheck size={16} />
    </button>
    
    {/* NEW: Pitch Deck Button */}
    <button
      onClick={() => navigate(`/pitch-deck?dealId=${deal.dealId}`)}
      style={{
        ...actionButtonStyle,
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        borderColor: '#2563eb'
      }}
      title="Generate Pitch Deck"
    >
      <Presentation size={16} />
    </button>
    
    {/* Existing buttons ... */}
  </div>
</td>
```

---

## Phase 5: Pitch Deck Page (Basic Structure)

### 5.1 Create Pitch Deck Page

**New File:** `client/src/pages/PitchDeckPage.js`

```javascript
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Download, Presentation, Image } from 'lucide-react';
import { loadDeal } from '../lib/dealsService';

const PitchDeckPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get('dealId');
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dealId) {
      loadDeal(dealId).then(data => {
        setDeal(data);
        setLoading(false);
      });
    }
  }, [dealId]);

  if (loading) return <div>Loading...</div>;
  if (!deal) return <div>Deal not found</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => navigate('/dashboard')} style={{ /* button styles */ }}>
            <Home size={16} /> Back to Dashboard
          </button>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#111827' }}>
            <Presentation size={32} style={{ marginRight: 12, verticalAlign: 'middle' }} />
            Pitch Deck Generator
          </h1>
          <button style={{ /* download button styles */ }}>
            <Download size={16} /> Export PDF
          </button>
        </div>

        {/* Deal Summary */}
        <div style={{ background: '#f9fafb', padding: 24, borderRadius: 12, marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{deal.address}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div>
              <p style={{ fontSize: 12, color: '#6b7280' }}>Purchase Price</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>${(deal.purchase_price || 0).toLocaleString()}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: '#6b7280' }}>Units</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{deal.units || 0}</p>
            </div>
            {/* Add more metrics */}
          </div>
        </div>

        {/* Property Photos Section */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center' }}>
            <Image size={20} style={{ marginRight: 8 }} />
            Property Photos ({(deal.images || []).length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {(deal.images || []).map((img, idx) => (
              <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <img src={img.url} alt={`Photo ${idx + 1}`} style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                <div style={{ padding: 8, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
                  Page {img.page_number}
                </div>
              </div>
            ))}
          </div>
          {(!deal.images || deal.images.length === 0) && (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>
              No images available for this deal
            </p>
          )}
        </div>

        {/* Pitch Deck Template Placeholder */}
        <div style={{ background: '#fef3c7', padding: 40, borderRadius: 12, textAlign: 'center' }}>
          <Presentation size={48} color="#d97706" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Pitch Deck Template Coming Soon</h3>
          <p style={{ color: '#92400e' }}>Template builder will be added here</p>
        </div>
      </div>
    </div>
  );
};

export default PitchDeckPage;
```

### 5.2 Add Route

**File:** `client/src/App.js`

```javascript
import PitchDeckPage from './pages/PitchDeckPage';

// In routes:
<Route path="/pitch-deck" element={<PitchDeckPage />} />
```

---

## Phase 6: Testing Checklist

### 6.1 Backend Testing
- [ ] PDF upload extracts images correctly
- [ ] Images uploaded to Supabase Storage bucket
- [ ] Image URLs returned in parse response
- [ ] Temporary files cleaned up after upload

### 6.2 Database Testing
- [ ] Images column added to deals table
- [ ] Image data saved correctly when deal pushed to pipeline
- [ ] Images persist after page reload

### 6.3 Frontend Testing
- [ ] Images display in Results page Photos tab
- [ ] Images display in Pitch Deck page
- [ ] Pitch Deck button appears in Pipeline actions
- [ ] Clicking Pitch Deck button navigates correctly
- [ ] Images load from Supabase CDN

---

## Phase 7: Future Enhancements

### 7.1 Image Selection for Pitch Deck
- Allow users to select which images to include
- Reorder images via drag-and-drop
- Add captions to images

### 7.2 Pitch Deck Templates
- Multiple template designs (Modern, Classic, Investor-focused)
- Customizable branding (logo, colors)
- Export to PowerPoint/PDF

### 7.3 AI Image Analysis
- Use Claude Vision to analyze property photos
- Auto-generate image captions
- Identify property features (pool, parking, amenities)

---

## Implementation Order

**Week 1:**
1. Add PyMuPDF dependency
2. Implement image extraction in `parser_v4.py`
3. Create Supabase Storage bucket
4. Run database migration

**Week 2:**
1. Create `image_storage.py`
2. Update `/parse_om` endpoint
3. Test image extraction and upload

**Week 3:**
1. Update `saveDeal` to include images
2. Add Photos tab to Results page
3. Create basic Pitch Deck page
4. Add Pitch Deck button to Pipeline

**Week 4:**
1. Polish UI/UX
2. Add image loading states
3. Error handling
4. Performance optimization

---

## Dependencies to Install

### Backend:
```bash
cd backend
pip install PyMuPDF supabase
```

### Frontend:
```bash
cd client
npm install lucide-react  # Already installed
```

---

## Environment Variables Needed

Add to `backend/.env`:
```
SUPABASE_URL=https://ylvnrtbkpsnpgskbkbyy.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

---

## Key Benefits

1. **Automated Image Extraction**: No manual photo upload needed
2. **Persistent Storage**: Images saved with deal data
3. **Fast Access**: Supabase CDN for quick image loading
4. **Pitch Deck Ready**: Images ready for investor presentations
5. **Scalable**: Can handle multiple deals with many images each

---

## Risk Mitigation

1. **Large PDFs**: Some OMs may have 50+ images
   - Solution: Implement image compression
   - Limit to first 20 images or images over 50KB

2. **Storage Costs**: Supabase Storage has limits
   - Solution: Monitor usage, implement cleanup for deleted deals

3. **Slow Upload**: Many images take time
   - Solution: Upload in background, show progress bar

4. **Image Quality**: Some extracted images may be low-res
   - Solution: Set minimum resolution filter

---

## Success Metrics

- [ ] 100% of uploaded PDFs have images extracted
- [ ] Images display correctly in Results and Pitch Deck pages
- [ ] Page load time < 2 seconds with images
- [ ] Zero image upload errors
- [ ] Users can generate pitch decks with deal photos

---

## Next Steps After Implementation

1. Get user feedback on image quality
2. Determine preferred pitch deck template style
3. Implement image selection/reordering
4. Add export to PowerPoint feature
5. Consider AI-powered image analysis

