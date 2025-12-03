from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime
import requests
import os
from bson import ObjectId

# --- Load environment variables ---
load_dotenv(dotenv_path="./.env")

# --- Initialize FastAPI ---
app = FastAPI()

# --- Enable CORS for frontend access ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global variables ---
db_status = "❌ MongoDB not connected"
vt_status = "⚠️ VirusTotal API key not loaded"
collection = None
otx_status = "❌ Alien Vault OTX key not loaded"


# --- Startup Event ---
@app.on_event("startup")
def startup_event():
    global db_status, vt_status, collection, otx_status

    # Load environment variables
    MONGO_URI = os.getenv("MONGO_URI")
    VT_API_KEY = os.getenv("VT_API_KEY")
    OTX_KEY = os.getenv("OTX_KEY")

    # Check MongoDB Connection
    try:
        client = MongoClient(MONGO_URI)
        db = client["threat_intelligence"]
        collection = db["reports"]
        db.command("ping")
        db_status = "✅ MongoDB connection successful!"
        print(db_status)
    except Exception as e:
        db_status = f"❌ MongoDB connection failed: {e}"
        print(db_status)

    # Check VirusTotal API Key
    if VT_API_KEY:
        vt_status = "✅ VirusTotal API Key loaded successfully"
        print(vt_status)

    else:
        vt_status = "⚠️ VirusTotal API Key not found in .env file"
        print(vt_status)

    if OTX_KEY :
        otx_status = "✅ OTX API Key loaded successfully"
        print(otx_status)

    else:
        otx_status = "OTX API Key not found in .env file."
        print(otx_status)

# --- Home Route ---
@app.get("/")
def home():
    return {
        "message": "🚀 Backend running successfully!",
        "database_status": db_status,
        "virustotal_status": vt_status,
        "alien_vault_status" : otx_status
    }


# --- Scan API Route ---

from bson import ObjectId  # ✅ add this import

def scan_otx(domain: str):
        OTX_KEY = os.getenv("OTX_KEY")
        url = f"https://otx.alienvault.com/api/v1/indicators/domain/{domain}/general"
        headers = {"X-OTX-API-KEY":OTX_KEY}

        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                return {"error": f"OTX API returned {response.status_code}", "details": response.text}
            
            data = response.json()
            pulses = data.get("pulse_info",{})
            pulse_count = pulses.get("count",0)
            pulse_names = [p["name"] for p in pulses.get("pulses",[])]

            result = {
                "domain":domain,
                "otx_pulse_count": pulse_count,
                "related_pulses": pulse_names,
                "reputation": data.get("reputation","N/A"),
            }
            return result
        except Exception as e:
            return {"Error" : "Request to OTX failed", "details": str(e)}

@app.get("/scan")
def scan_domain(domain: str = Query(..., description="Enter the domain to scan")):
    VT_API_KEY = os.getenv("VT_API_KEY")
    url = f"https://www.virustotal.com/api/v3/domains/{domain}"
    headers = {"x-apikey": VT_API_KEY}
     
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return {"error": f"VirusTotal API returned {response.status_code}", "details": response.text}

        data = response.json()
    except Exception as e:
        return {"error": "Request to VirusTotal failed", "details": str(e)}


     #OTX Integration
    otx_data = scan_otx(domain)

    attributes = data.get("data", {}).get("attributes", {})
    last_analysis_stats = attributes.get("last_analysis_stats", {
        "harmless": 0,
        "malicious": 0,
        "suspicious": 0,
        "undetected": 0
    })

    clean_result = {
        "domain": domain,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "reputation": attributes.get("reputation", "N/A"),
        "last_analysis_stats": last_analysis_stats,
        "categories": attributes.get("categories", {}),
        "whois": attributes.get("whois", "Not available"),

        "alienvault_otx":otx_data
    }

    # ✅ Insert into MongoDB safely
    try:
        insert_result = collection.insert_one(clean_result)
        clean_result["_id"] = str(insert_result.inserted_id)  # Convert ObjectId to string
    except Exception as e:
        clean_result["db_save_error"] = str(e)

    return clean_result


