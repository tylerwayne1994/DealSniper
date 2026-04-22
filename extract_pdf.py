import pdfplumber

pdf_path = r'C:\Users\hello\DealSniper\client\public\Appleby_Courtyard_Underwriting.pdf'
try:
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Total pages: {len(pdf.pages)}\n")
        
        # Extract all pages
        for i, page in enumerate(pdf.pages):
            print(f"\n{'='*80}")
            print(f"PAGE {i+1}")
            print(f"{'='*80}\n")
            text = page.extract_text()
            print(text)
except Exception as e:
    print(f"Error: {e}")
