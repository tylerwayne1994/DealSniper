import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from excel_to_spreadsheet import load_excel_template

app = FastAPI(title="Template Server", version="1.0.0")

@app.get("/api/spreadsheet/get-template")
async def get_spreadsheet_template():
    try:
        data = load_excel_template()
        return JSONResponse(content={"success": True, "data": data})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8010)
