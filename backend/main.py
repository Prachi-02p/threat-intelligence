from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime
import requests
import os
from bson import ObjectId
from contextlib import asynccontextmanager

# --- Load environment variables from .env ---
load_dotenv(dotenv_path="./.env")

# --- Lifespan for startup and shutdown ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup code ---
    MONGO_URI = os.getenv("MONGODB_URI")
    VT_API_KEY = os.getenv("VT_API_KEY")
    OTX_KEY = os.getenv("OTX_KEY")

    try:
        client = MongoClient(MONGO_URI)
        app.db = client["threat_intelligence"]
        app.collection = app.db["reports"]
        app.db_status = "✅ MongoDB connection successful!"
        print(app.db_status)
    except Exception as e:
        app.db_status = f"❌ MongoDB connection failed: {e}"
        print(app.db_status)

    app.vt_status = "✅ VirusTotal API Key loaded" if VT_API_KEY else "⚠️ VirusTotal API Key not found"
    app.otx_status = "✅ OTX API Key loaded" if OTX_KEY else "⚠️ OTX API Key not found"

    yield  # App is running

    # --- Shutdown code ---
    try:
        client.close()
        print("MongoDB connection closed")
    except:
        pass

# --- Initialize FastAPI with lifespan ---
app = FastAPI(lifespan=lifespan)

# --- Enable CORS for frontend access ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Home route ---
@app.get("/")
def home():
    return {
        "message": "🚀 Backend running successfully!",
        "database_status": getattr(app, "db_status", "❌ MongoDB not connected"),
        "virustotal_status": getattr(app, "vt_status", "⚠️ VirusTotal API key not loaded"),
        "alien_vault_status": getattr(app, "otx_status", "❌ Alien Vault OTX key not loaded")
    }

# --- Helper function to scan AlienVault OTX ---
def scan_otx(domain: str):
    OTX_KEY = os.getenv("OTX_KEY")
    if not OTX_KEY:
        return {"error": "OTX API Key not loaded"}

    url = f"https://otx.alienvault.com/api/v1/indicators/domain/{domain}/general"
    headers = {"X-OTX-API-KEY": OTX_KEY}

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return {"error": f"OTX API returned {response.status_code}", "details": response.text}

        data = response.json()
        pulses = data.get("pulse_info", {})
        pulse_count = pulses.get("count", 0)
        pulse_names = [p["name"] for p in pulses.get("pulses", [])]

        return {
            "domain": domain,
            "otx_pulse_count": pulse_count,
            "related_pulses": pulse_names,
            "reputation": data.get("reputation", "N/A")
        }
    except Exception as e:
        return {"Error": "Request to OTX failed", "details": str(e)}

# --- Scan endpoint ---
@app.get("/scan")
def scan_domain(domain: str = Query(..., description="Enter the domain to scan")):
    VT_API_KEY = os.getenv("VT_API_KEY")
    if not VT_API_KEY:
        return {"error": "VirusTotal API Key not loaded"}

    url = f"https://www.virustotal.com/api/v3/domains/{domain}"
    headers = {"x-apikey": VT_API_KEY}

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return {"error": f"VirusTotal API returned {response.status_code}", "details": response.text}

        data = response.json()
    except Exception as e:
        return {"error": "Request to VirusTotal failed", "details": str(e)}

    # --- OTX data ---
    otx_data = scan_otx(domain)

    attributes = data.get("data", {}).get("attributes", {})
    last_analysis_stats = attributes.get("last_analysis_stats", {
        "harmless": 0,
        "malicious": 0,
        "suspicious": 0,
        "undetected": 0
    })

    result = {
        "domain": domain,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "reputation": attributes.get("reputation", "N/A"),
        "last_analysis_stats": last_analysis_stats,
        "categories": attributes.get("categories", {}),
        "whois": attributes.get("whois", "Not available"),
        "alienvault_otx": otx_data
    }

    # --- Save to MongoDB ---
    try:
        insert_result = app.collection.insert_one(result)
        result["_id"] = str(insert_result.inserted_id)
    except Exception as e:
        result["db_save_error"] = str(e)

    return result
