# zoning_router.py — ArcGIS zoning overlay proxy
import re
import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Optional

router = APIRouter()

# ---------------------------------------------------------------------------
# 85 verified ArcGIS zoning endpoints — 4 states, no API key required
# Each entry: base_url (without layer id), default_layer_id, zone_field,
#             label_field (optional), label, state
# ---------------------------------------------------------------------------

ZONING_SERVICES: dict[str, dict] = {
    # ── Arizona (13 + 4 legacy Mohave) ─────────────────────────────────────
    "mohave_bhc": {
        "label": "Bullhead City (Mohave)",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://mcgis2.mohavecounty.us/arcgis/rest/services/BHC_Zoning_Parcels/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONE_CODE",
        "label_field": "ZONE_DESC",
    },
    "mohave_kingman": {
        "label": "Kingman (Mohave)",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://mcgis2.mohavecounty.us/arcgis/rest/services/CoKgm_Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONE_CODE",
        "label_field": "ZONE_DESC",
    },
    "mohave_lhc": {
        "label": "Lake Havasu City (Mohave)",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://mcgis2.mohavecounty.us/arcgis/rest/services/LHC_Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONE_CODE",
        "label_field": "ZONE_DESC",
    },
    "mohave_general_plan": {
        "label": "Mohave County General Plan",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://mcgis2.mohavecounty.us/arcgis/rest/services/PZ_GeneralPlan/MapServer",
        "default_layer_id": 0,
        "zone_field": "GP_DESIG",
        "label_field": "GP_DESC",
    },
    "az_avondale": {
        "label": "City of Avondale",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://gisweb.avondaleaz.gov/server/rest/services/Planning/Zoning/MapServer",
        "default_layer_id": 6,
        "zone_field": "ZONETYPE",
        "label_field": "ZONETYPE",
    },
    "az_buckeye": {
        "label": "City of Buckeye",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://maps.buckeyeaz.gov/server/rest/services/GeneralPlanLandUse/MapServer",
        "default_layer_id": 0,
        "zone_field": "LandUseCode",
        "label_field": "LandUse",
    },
    "az_casa_grande": {
        "label": "City of Casa Grande",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://services8.arcgis.com/fqW4OZOL16y7Kl3a/ArcGIS/rest/services/Zoning_2010/FeatureServer",
        "default_layer_id": 1,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "az_flagstaff": {
        "label": "City of Flagstaff",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://services8.arcgis.com/KyZIQDOsXnGaTxj2/ArcGIS/rest/services/ZONING/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "Zoning",
        "label_field": "Zoning",
    },
    "az_kingman_city": {
        "label": "City of Kingman",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://services.arcgis.com/lQySeXwbBg53XWDi/ArcGIS/rest/services/zoning_districts/FeatureServer",
        "default_layer_id": 1,
        "zone_field": "ZoningCode",
        "label_field": "ZoningCode",
    },
    "az_phoenix": {
        "label": "City of Phoenix",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://maps.phoenix.gov/pub/rest/services/Public/Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONING",
        "label_field": "LABEL1",
    },
    "az_prescott": {
        "label": "City of Prescott",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://web-map.prescott-az.gov/arcgis/rest/services/Basemaps/AddressInfo/MapServer",
        "default_layer_id": 5,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "az_sierra_vista": {
        "label": "City of Sierra Vista",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://services6.arcgis.com/qsfT0E2It2u5vqBg/arcgis/rest/services/Zoning_Sierra_Vista_Test/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "az_tempe": {
        "label": "City of Tempe",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://gis.tempe.gov/arcgis/rest/services/Open_Data/Zoning_Districts/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "ZoningCode",
        "label_field": "ZoningCode",
    },
    "az_tucson": {
        "label": "City of Tucson",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://gis.tucsonaz.gov/arcgis/rest/services/PublicMaps/Zoning/MapServer",
        "default_layer_id": 31,
        "zone_field": "ZONE_ALL",
        "label_field": "ZONE_ALL",
    },
    "az_yuma": {
        "label": "City of Yuma",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://gis.ci.yuma.az.us/server/rest/services/pan/Zoning/MapServer",
        "default_layer_id": 8,
        "zone_field": "Zoning_Code",
        "label_field": "Zoning_Code",
    },
    "az_cochise": {
        "label": "Cochise County",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://services6.arcgis.com/Yxem0VOcqSy8T6TE/arcgis/rest/services/Dev_Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "zoning",
        "label_field": "zoning",
    },
    "az_yavapai": {
        "label": "Yavapai County",
        "region": "SW",
        "state": "AZ",
        "base_url": "https://gis.yavapaiaz.gov/ArcGIS/rest/services/Zoning/MapServer",
        "default_layer_id": 9,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },

    # ── California (42) ───────────────────────────────────────────────────
    "ca_alameda_county": {
        "label": "Alameda County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services7.arcgis.com/6Yz0DcWQc1LtdRPC/arcgis/rest/services/Alameda_County_Public_Access_Map_WFL1/FeatureServer",
        "default_layer_id": 20,
        "zone_field": "PRIMARY_ZONING",
        "label_field": "PRIMARY_ZONING",
    },
    "ca_anaheim": {
        "label": "City of Anaheim",
        "region": "SW",
        "state": "CA",
        "base_url": "https://gis.anaheim.net/server/rest/services/GIS/Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "ca_bakersfield": {
        "label": "City of Bakersfield",
        "region": "SW",
        "state": "CA",
        "base_url": "https://gis.bakersfieldcity.us/webmaps/rest/services/General/LandUse/FeatureServer",
        "default_layer_id": 7,
        "zone_field": "ZONE",
        "label_field": "DESCRIPTION",
    },
    "ca_chula_vista": {
        "label": "City of Chula Vista",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services2.arcgis.com/2nV1ORz8qFa0iiF2/arcgis/rest/services/Chula_Vista_Districts_and_Zones/FeatureServer",
        "default_layer_id": 1,
        "zone_field": "ZoneDescription",
        "label_field": "ZoneDescription",
    },
    "ca_escondido": {
        "label": "City of Escondido",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services.arcgis.com/uEH09Hfm70zI2ZxR/arcgis/rest/services/Escondido/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "CODE",
        "label_field": "CODE",
    },
    "ca_hayward": {
        "label": "City of Hayward",
        "region": "SW",
        "state": "CA",
        "base_url": "https://maps.hayward-ca.gov/arcgis/rest/services/OpenData/COH_Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONING_",
        "label_field": "ZONING_",
    },
    "ca_irvine": {
        "label": "City of Irvine",
        "region": "SW",
        "state": "CA",
        "base_url": "https://gis.cityofirvine.org/arcgis/rest/services/OnlineParcel/MapServer",
        "default_layer_id": 7,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "ca_long_beach": {
        "label": "City of Long Beach",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services6.arcgis.com/yCArG7wGXGyWLqav/arcgis/rest/services/Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "ZONING_SYMBOL",
        "label_field": "ZONING_SYMBOL",
    },
    "ca_los_angeles": {
        "label": "City of Los Angeles",
        "region": "SW",
        "state": "CA",
        "base_url": "https://maps.lacity.org/arcgis/rest/services/Mapping/NavigateLA/MapServer",
        "default_layer_id": 71,
        "zone_field": "ZONING_DESCRIPTION",
        "label_field": "ZONING_DESCRIPTION",
    },
    "ca_oakland": {
        "label": "City of Oakland",
        "region": "SW",
        "state": "CA",
        "base_url": "https://gismaps.oaklandca.gov/server/rest/services/Planning_and_Zoning_Controls/FeatureServer",
        "default_layer_id": 1,
        "zone_field": "BASEZONE",
        "label_field": "BASEZONE",
    },
    "ca_ontario": {
        "label": "City of Ontario",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services5.arcgis.com/74bZbbuf05Ctvbzv/arcgis/rest/services/City_of_Ontario_Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "zone",
        "label_field": "zone",
    },
    "ca_oxnard": {
        "label": "City of Oxnard",
        "region": "SW",
        "state": "CA",
        "base_url": "https://maps.oxnard.org/arcgis/rest/services/PlanningLayers/MapServer",
        "default_layer_id": 5,
        "zone_field": "Zone2030",
        "label_field": "ZoneDescription2030",
    },
    "ca_pasadena": {
        "label": "City of Pasadena",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services2.arcgis.com/zNjnZafDYCAJAbN0/ArcGIS/rest/services/Pasadena_Database_View/FeatureServer",
        "default_layer_id": 1,
        "zone_field": "CustomID",
        "label_field": "CustomID",
    },
    "ca_riverside_city": {
        "label": "City of Riverside",
        "region": "SW",
        "state": "CA",
        "base_url": "https://mapriverside.riversideca.gov/server/rest/services/Planning/Zoning_Official/MapServer",
        "default_layer_id": 14,
        "zone_field": "ZoneCodeLabel",
        "label_field": "ZoneCodeLabel",
    },
    "ca_sacramento_city": {
        "label": "City of Sacramento",
        "region": "SW",
        "state": "CA",
        "base_url": "https://mapservices.gis.saccounty.net/arcgis/rest/services/CITY_of_SACRAMENTO/MapServer",
        "default_layer_id": 3,
        "zone_field": "ZONE",
        "label_field": "ZONE",
    },
    "ca_san_bernardino": {
        "label": "City of San Bernardino",
        "region": "SW",
        "state": "CA",
        "base_url": "https://gisweb.sbcity.org/arcgis/rest/services/Zoning/Zoning_2023/MapServer",
        "default_layer_id": 1,
        "zone_field": "ZoningShort",
        "label_field": "ZoningLong",
    },
    "ca_san_francisco": {
        "label": "City of San Francisco",
        "region": "SW",
        "state": "CA",
        "base_url": "https://sfplanninggis.org/arcgiswa/rest/services/ImpactFees/MapServer",
        "default_layer_id": 8,
        "zone_field": "zoning_sim",
        "label_field": "districtname",
    },
    "ca_san_luis_obispo": {
        "label": "City of San Luis Obispo",
        "region": "SW",
        "state": "CA",
        "base_url": "https://maps.slocity.org/hosting/rest/services/slogisLayers/MapServer",
        "default_layer_id": 5,
        "zone_field": "generalZone",
        "label_field": "specificZone",
    },
    "ca_santa_barbara_city": {
        "label": "City of Santa Barbara",
        "region": "SW",
        "state": "CA",
        "base_url": "https://gisportal.santabarbaraca.gov/server1/rest/services/CitySantaBarbara/MapServer",
        "default_layer_id": 256,
        "zone_field": "Zone_1",
        "label_field": "Zone_1",
    },
    "ca_santa_rosa": {
        "label": "City of Santa Rosa",
        "region": "SW",
        "state": "CA",
        "base_url": "https://socogis.sonomacounty.ca.gov/map/rest/services/OWTSPublic/Land_Use_City_Santa_Rosa/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "GP_LANDUSE",
        "label_field": "GP_LANDUSE",
    },
    "ca_stockton": {
        "label": "City of Stockton",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services7.arcgis.com/7WRZWVaTK828hbiZ/arcgis/rest/services/Zoning_Final/FeatureServer",
        "default_layer_id": 3,
        "zone_field": "ZoningDist",
        "label_field": "ZoningDist",
    },
    "ca_sunnyvale": {
        "label": "City of Sunnyvale",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services5.arcgis.com/ecWT8iam2AWjfm3E/arcgis/rest/services/Sunnyvale_Base_Map/FeatureServer",
        "default_layer_id": 16,
        "zone_field": "Zone_Class_Code",
        "label_field": "Zone_Class_Code",
    },
    "ca_torrance": {
        "label": "City of Torrance",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services.arcgis.com/CWv1abTnC3urn4bV/ArcGIS/rest/services/IDO_Zoning_Conversion/FeatureServer",
        "default_layer_id": 1,
        "zone_field": "IDOZoneDistrict",
        "label_field": "IDOZoneDistrict",
    },
    "ca_contra_costa": {
        "label": "Contra Costa County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services.arcgis.com/jDGuO8tYggdCCnUJ/arcgis/rest/services/ContraCostaCountyPlanningLayers/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "GP_LU_DES",
        "label_field": "GP_TEXT",
    },
    "ca_el_dorado": {
        "label": "El Dorado County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services.arcgis.com/UHg8l1wC48WQyDSO/arcgis/rest/services/Zoning2/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "ZONEDES",
        "label_field": "ZONEDES",
    },
    "ca_fresno_county": {
        "label": "Fresno County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services3.arcgis.com/ivgOteCWSY7ZTRyd/arcgis/rest/services/Fresno_County_Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "Zone",
        "label_field": "General_Zo",
    },
    "ca_kern": {
        "label": "Kern County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services5.arcgis.com/Y8jwjGUWbRjuqpG5/arcgis/rest/services/Kern_County_Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "Zn_Cd1",
        "label_field": "Zn_Cd1",
    },
    "ca_la_county": {
        "label": "Los Angeles County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://arcgis.gis.lacounty.gov/arcgis/rest/services/DRP/GISNET_Public/MapServer",
        "default_layer_id": 346,
        "zone_field": "ZONE",
        "label_field": "ZONE",
    },
    "ca_napa": {
        "label": "Napa County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://gis.napacounty.gov/arcgis/rest/services/Hosted/Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "zoning",
        "label_field": "zoning",
    },
    "ca_orange_county": {
        "label": "Orange County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services.arcgis.com/UXmFoWC7yDHcDN5Q/arcgis/rest/services/OCZoning_P/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "ZONECLASS",
        "label_field": "ZONECLASS",
    },
    "ca_riverside_county": {
        "label": "Riverside County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://mapriverside.riversideca.gov/server/rest/services/Planning/Planning/MapServer",
        "default_layer_id": 23,
        "zone_field": "ZoneAbbreviation",
        "label_field": "ZoneAbbreviation",
    },
    "ca_sacramento_county": {
        "label": "Sacramento County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://mapservices.gis.saccounty.net/arcgis/rest/services/PLANNING/MapServer",
        "default_layer_id": 16,
        "zone_field": "B_ZONE",
        "label_field": "B_ZONE",
    },
    "ca_san_diego_county": {
        "label": "San Diego County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://gis-public.sandiegocounty.gov/arcgis/rest/services/PDS/PDS_Layers/MapServer",
        "default_layer_id": 3,
        "zone_field": "USEREG",
        "label_field": "USEREG",
    },
    "ca_san_joaquin": {
        "label": "San Joaquin County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services9.arcgis.com/mt4kvYhNXSa5AqLG/ArcGIS/rest/services/Parcels_Zoning_SJV_CRC_2019/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "Zoning_Original",
        "label_field": "Zoning_Original",
    },
    "ca_san_mateo": {
        "label": "San Mateo County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services.arcgis.com/yq3FgOI44hYHAFVZ/arcgis/rest/services/GIS_Data/FeatureServer",
        "default_layer_id": 9,
        "zone_field": "ZONE",
        "label_field": "ZONE_DESC_",
    },
    "ca_santa_barbara_county": {
        "label": "Santa Barbara County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services.arcgis.com/KkJhFbLnXVqahKz2/arcgis/rest/services/LandUseDesignations/FeatureServer",
        "default_layer_id": 235,
        "zone_field": "LAND_USE",
        "label_field": "LAND_USE",
    },
    "ca_santa_clara": {
        "label": "Santa Clara County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services2.arcgis.com/tcv2cMrq63AgvbHF/arcgis/rest/services/Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "_BaseZone_",
        "label_field": "_BaseZone_",
    },
    "ca_shasta": {
        "label": "Shasta County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://gis.shastacounty.gov/arcgis/rest/services/OpenData/ZoningLinks/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "ca_solano": {
        "label": "Solano County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://solanocountygis.com/server/rest/services/Aumentum/AumentumInternal/MapServer",
        "default_layer_id": 17,
        "zone_field": "ZONE_ABREV",
        "label_field": "ZONE_NAME",
    },
    "ca_sonoma": {
        "label": "Sonoma County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://socogis.sonomacounty.ca.gov/map/rest/services/PictometrySecure/Sonoma_County_Pictometry/FeatureServer",
        "default_layer_id": 3,
        "zone_field": "BASEZONING",
        "label_field": "BASEZONING",
    },
    "ca_stanislaus": {
        "label": "Stanislaus County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://services.arcgis.com/EeYBJFxLdUojipYa/arcgis/rest/services/Zoning_AGOL/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "Zone_Descr",
        "label_field": "Zone_Descr",
    },
    "ca_tulare": {
        "label": "Tulare County",
        "region": "SW",
        "state": "CA",
        "base_url": "https://ihost.tularecounty.ca.gov/ihost/rest/services/PublicZoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "whoDO",
        "label_field": "whoDO",
    },

    # ── North Carolina (22) ───────────────────────────────────────────────
    "nc_cabarrus": {
        "label": "Cabarrus County",
        "region": "SE",
        "state": "NC",
        "base_url": "https://location.cabarruscounty.us/arcgisservices/rest/services/Zoning/MapServer",
        "default_layer_id": 7,
        "zone_field": "ZONINGCODE",
        "label_field": "ZONINGCODE",
    },
    "nc_catawba": {
        "label": "Catawba County (Van Wyck)",
        "region": "SE",
        "state": "NC",
        "base_url": "https://services8.arcgis.com/h9JHFVWvWofKfQhH/arcgis/rest/services/Van_Wyck_Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "Zoning",
        "label_field": "Zoning",
    },
    "nc_chatham": {
        "label": "Chatham County",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gisservices.chathamcountync.gov/opendataagol/rest/services/LandUsePlanning/Chatham_CountyZoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZoningClassification",
        "label_field": "ZoningClassification",
    },
    "nc_asheville": {
        "label": "City of Asheville",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gis.ashevillenc.gov/server/rest/services/Districts/ZoningDistricts/MapServer",
        "default_layer_id": 11,
        "zone_field": "districts",
        "label_field": "districts",
    },
    "nc_cary": {
        "label": "City of Cary",
        "region": "SE",
        "state": "NC",
        "base_url": "https://maps-apis.carync.gov/server/rest/services/LandUse/Zoning/MapServer",
        "default_layer_id": 11,
        "zone_field": "ZONECLASS",
        "label_field": "ZONECLASS",
    },
    "nc_chapel_hill": {
        "label": "City of Chapel Hill",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gis-portal.townofchapelhill.org/server/rest/services/OpenData/Overlay_Zoning_Districts/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "DISTRICT",
        "label_field": "SYMBOL",
    },
    "nc_concord": {
        "label": "City of Concord",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gis.cityofconcord.org/gsrv1/rest/services/PublicGIS/MapServer",
        "default_layer_id": 3,
        "zone_field": "ZONECLASS",
        "label_field": "ZONECLASS",
    },
    "nc_gastonia": {
        "label": "City of Gastonia",
        "region": "SE",
        "state": "NC",
        "base_url": "https://cogserver.gastonianc.gov/serverweb/rest/services/Planning/Zoning_UDO/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "nc_greensboro": {
        "label": "City of Greensboro",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gis.greensboro-nc.gov/arcgis/rest/services/Planning/DevelopmentServices_MS/MapServer",
        "default_layer_id": 35,
        "zone_field": "ZONINGDISTRICT",
        "label_field": "ZONINGDISTRICT",
    },
    "nc_greenville": {
        "label": "City of Greenville",
        "region": "SE",
        "state": "NC",
        "base_url": "https://arcgis.townofgreenville.com/server/rest/services/CED/Zoning/FeatureServer",
        "default_layer_id": 1,
        "zone_field": "PZoneName1",
        "label_field": "PZoneName1",
    },
    "nc_high_point": {
        "label": "City of High Point",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gisentapp01.highpointnc.gov/server/rest/services/Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONE",
        "label_field": "ZONE",
    },
    "nc_kannapolis": {
        "label": "City of Kannapolis",
        "region": "SE",
        "state": "NC",
        "base_url": "https://location.cabarruscounty.us/arcgisservices/rest/services/opendata/MapServer",
        "default_layer_id": 38,
        "zone_field": "ZONINGCODE",
        "label_field": "ZONINGCODE",
    },
    "nc_wilson": {
        "label": "City of Wilson",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gis.wilsonnc.org/services/rest/services/publiclayers/Zoning/FeatureServer",
        "default_layer_id": 1,
        "zone_field": "CURRENTZONE",
        "label_field": "CURRENTZONE",
    },
    "nc_winston_salem": {
        "label": "City of Winston-Salem",
        "region": "SE",
        "state": "NC",
        "base_url": "https://maps.co.forsyth.nc.us/arcgis/rest/services/MapMetrics/Boundaries/FeatureServer",
        "default_layer_id": 26,
        "zone_field": "DISTRICTNAME",
        "label_field": "DISTRICTNAME",
    },
    "nc_forsyth": {
        "label": "Forsyth County",
        "region": "SE",
        "state": "NC",
        "base_url": "https://maps.co.forsyth.nc.us/arcgis/rest/services/MapMetrics/terra/FeatureServer",
        "default_layer_id": 1,
        "zone_field": "ZONING_DISTRICT",
        "label_field": "ZONING_JURISDICTION",
    },
    "nc_gaston": {
        "label": "Gaston County",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gis.gastoncountync.gov/publicgis/rest/services/PublicGIS/Zoning/MapServer",
        "default_layer_id": 1,
        "zone_field": "TYPE",
        "label_field": "Name",
    },
    "nc_guilford": {
        "label": "Guilford County",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gcgis.guilfordcountync.gov/arcgis/rest/services/GISDV/Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "nc_iredell": {
        "label": "Iredell County",
        "region": "SE",
        "state": "NC",
        "base_url": "https://maps.iredellcountync.gov/server/rest/services/Data/Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "nc_mecklenburg": {
        "label": "Mecklenburg County (Charlotte)",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZoneDes",
        "label_field": "ZoneDes",
    },
    "nc_new_hanover": {
        "label": "New Hanover County",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gis.nhcgov.com/server/rest/services/Layers/Zoning/MapServer",
        "default_layer_id": 3,
        "zone_field": "ZONING",
        "label_field": "ZONING",
    },
    "nc_pitt": {
        "label": "Pitt County",
        "region": "SE",
        "state": "NC",
        "base_url": "https://gis.pittcountync.gov/gis/rest/services/OPIS/FunctionalLayers/MapServer",
        "default_layer_id": 59,
        "zone_field": "ZONE",
        "label_field": "ZONE",
    },
    "nc_wake": {
        "label": "Wake County (Wake Forest)",
        "region": "SE",
        "state": "NC",
        "base_url": "https://twfgis.wakeforestnc.gov/server/rest/services/Zoning/MapServer",
        "default_layer_id": 0,
        "zone_field": "ZoneClass",
        "label_field": "ZoneClass",
    },

    # ── South Carolina (4) ────────────────────────────────────────────────
    "sc_beaufort": {
        "label": "Beaufort County",
        "region": "SE",
        "state": "SC",
        "base_url": "https://gis.beaufortcountysc.gov/server/rest/services/Zoning/MapServer",
        "default_layer_id": 9,
        "zone_field": "FBCode",
        "label_field": "FBCode",
    },
    "sc_sumter": {
        "label": "City of Sumter",
        "region": "SE",
        "state": "SC",
        "base_url": "https://gis.sumter-sc.com/server/rest/services/Planning/Zoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "ZONECLASS",
        "label_field": "ZONECLASS",
    },
    "sc_greenville": {
        "label": "Greenville County",
        "region": "SE",
        "state": "SC",
        "base_url": "https://services1.arcgis.com/x5wCko8UnSi4h0CB/arcgis/rest/services/GreenvilleCountyZoning/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "FEAT_CODE",
        "label_field": "FEAT_CODE",
    },
    "sc_york": {
        "label": "York County",
        "region": "SE",
        "state": "SC",
        "base_url": "https://services1.arcgis.com/2AGLxyiJoNiVHKwq/arcgis/rest/services/York County Zoning (regions)/FeatureServer",
        "default_layer_id": 0,
        "zone_field": "zone",
        "label_field": "zone",
    },
}

STATE_NAMES = {"AZ": "Arizona", "CA": "California", "NC": "North Carolina", "SC": "South Carolina"}

ARCGIS_TIMEOUT = 30
MAX_RECORD_COUNT = 2000


@router.get("/api/zoning/services")
async def list_services():
    """List all available zoning overlay services, grouped by region."""
    return {
        key: {
            "label": val["label"],
            "state": val.get("state", "AZ"),
            "region": val.get("region", "SW"),
        }
        for key, val in ZONING_SERVICES.items()
    }


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
