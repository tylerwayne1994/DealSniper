from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import hud_client

router = APIRouter()


@router.get('/api/hud/fmr/data/{entityid}')
def proxy_fmr_data(entityid: str, year: Optional[int] = None):
    try:
        data = hud_client.fetch_fmr(entityid, year)
        return JSONResponse(content={"success": True, "data": data})
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/api/hud/fmr/listCounties/{state_code}')
def proxy_list_counties(state_code: str):
    try:
        data = hud_client.list_counties(state_code)
        return JSONResponse(content={"success": True, "data": data})
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
