# zoning_router.py — ArcGIS zoning overlay proxy
import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Optional

router = APIRouter()

ZONING_SERVICES: dict[str, dict] = {
    "mohave_bhc": {
        "label": "Bullhead City Zoning",
        "base_url": "https://mcgis2.mohavecounty.us/arcgis/rest/services/BHC_Zoning_Parcels/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONE_CODE",
        "label_field": "ZONE_DESC",
    },
    "mohave_kingman": {
        "label": "Kingman Zoning",
        "base_url": "https://mcgis2.mohavecounty.us/arcgis/rest/services/CoKgm_Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONE_CODE",
        "label_field": "ZONE_DESC",
    },
    "mohave_lhc": {
        "label": "Lake Havasu City Zoning",
        "base_url": "https://mcgis2.mohavecounty.us/arcgis/rest/services/LHC_Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONE_CODE",
        "label_field": "ZONE_DESC",
    },
    "mohave_general_plan": {
        "label": "Mohave County General Plan",
        "base_url": "https://mcgis2.mohavecounty.us/arcgis/rest/services/PZ_GeneralPlan/MapServer",
        "default_layer_id": 0,
        "zone_field": "GP_DESIG",
        "label_field": "GP_DESC",
    },
}

ARCGIS_TIMEOUT = 30
MAX_RECORD_COUNT = 2000


@router.get("/api/zoning/services")
async def list_services():
    """List all available zoning overlay services."""
    return {key: {"label": val["label"]} for key, val in ZONING_SERVICES.items()}


@router.get("/api/zoning/{service_key}")
async def get_zoning(
    service_key: str,
    layer_id: Optional[int] = Query(default=None),
    bbox: Optional[str] = Query(default=None),
):
    """Fetch zoning GeoJSON from an ArcGIS MapServer, optionally filtered by bbox."""
    if service_key not in ZONING_SERVICES:
        raise HTTPException(status_code=404, detail=f"Service '{service_key}' not found.")

    config = ZONING_SERVICES[service_key]
    resolved_layer_id = layer_id if layer_id is not None else config["default_layer_id"]
    query_url = f"{config['base_url']}/{resolved_layer_id}/query"

    params = {
        "where": "1=1",
        "outFields": "*",
        "f": "geojson",
        "outSR": "4326",
        "resultRecordCount": MAX_RECORD_COUNT,
    }

    if bbox:
        parts = bbox.split(",")
        if len(parts) != 4:
            raise HTTPException(status_code=400, detail="bbox must be 4 comma-separated values")
        try:
            minx, miny, maxx, maxy = [float(p.strip()) for p in parts]
        except ValueError:
            raise HTTPException(status_code=400, detail="bbox values must be numeric")
        params.update({
            "geometry": f"{minx},{miny},{maxx},{maxy}",
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
        })

    try:
        async with httpx.AsyncClient(timeout=ARCGIS_TIMEOUT) as client:
            response = await client.get(query_url, params=params)
            response.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="ArcGIS server timed out")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"ArcGIS returned {exc.response.status_code}")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    data = response.json()
    if "error" in data:
        raise HTTPException(
            status_code=502,
            detail=f"ArcGIS error: {data['error'].get('message', str(data['error']))}",
        )

    # Attach config metadata so the frontend knows which fields to use
    data["_zoning_config"] = {
        "service_key": service_key,
        "label": config["label"],
        "zone_field": config["zone_field"],
        "label_field": config["label_field"],
    }
    return JSONResponse(content=data)


@router.get("/api/zoning/{service_key}/fields")
async def get_service_fields(
    service_key: str,
    layer_id: Optional[int] = Query(default=None),
):
    """Return the field schema for a zoning layer (useful for debugging)."""
    if service_key not in ZONING_SERVICES:
        raise HTTPException(status_code=404, detail=f"Service '{service_key}' not found.")

    config = ZONING_SERVICES[service_key]
    resolved_layer_id = layer_id if layer_id is not None else config["default_layer_id"]
    info_url = f"{config['base_url']}/{resolved_layer_id}"

    async with httpx.AsyncClient(timeout=ARCGIS_TIMEOUT) as client:
        response = await client.get(info_url, params={"f": "json"})
        response.raise_for_status()

    data = response.json()
    return {
        "service_key": service_key,
        "layer_id": resolved_layer_id,
        "fields": [
            {"name": f["name"], "type": f["type"], "alias": f.get("alias", "")}
            for f in data.get("fields", [])
        ],
    }
