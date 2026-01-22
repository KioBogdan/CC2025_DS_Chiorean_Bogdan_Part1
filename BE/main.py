from fastapi import FastAPI, Depends, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware #cors policies
from dotenv import load_dotenv
from auth import get_current_user
from storage import read_latest_device_json, list_latest_devices
import os
from datetime import datetime
from collections import defaultdict

load_dotenv() # Load .env file

# Read allowed origins from environment
origins_env = os.getenv("ALLOWED_ORIGINS", "") #read allowed origins ()
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

print("ALLOWED_ORIGINS raw:", os.getenv("ALLOWED_ORIGINS")) #check print
print("Parsed origins:", origins)

# print("AWS_REGION:", os.getenv("AWS_REGION"))
# print("COGNITO_USER_POOL_ID:", os.getenv("COGNITO_USER_POOL_ID"))
# print("COGNITO_APP_CLIENT_ID:", os.getenv("COGNITO_APP_CLIENT_ID"))

app = FastAPI() #Create fastAPI instance

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)
# ----------------------------------

#connect endpoint
@app.get("/api/connect")
async def root():
    return {"message": "Succesfully connected to backend"}

#profile endpoint
@app.get("/api/profile")
def profile(user=Depends(get_current_user)):
    return {
        "email": user.get("email"),
        "groups": user.get("cognito:groups", []),
        "device_id": user.get("custom:device_id"),
        "sub": user.get("sub"),
        "issuer": user.get("iss"),
    }

#device filtering (admin/user)
@app.get("/api/data")
def get_data(
    device_id: str | None = Query(default=None),
    user=Depends(get_current_user),
):
    groups = user.get("cognito:groups") or []
    is_admin = "admin" in groups
    user_device = user.get("custom:device_id")

    if is_admin: #admin can read any device (as long as it exists)
        if not device_id: 
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required query parameter: device_id",
            )
    else:  #user can read only its assigned devices
        if not user_device: 
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no custom:device_id claim; access denied",
            )
        device_id = user_device

    # Read JSON blob; storage.py should raise 404 if missing
    payload = read_latest_device_json(device_id)

    return {
        "device_id": device_id,
        "is_admin": is_admin,
        "data": payload,
    }

#admin call (see all available data)
@app.get("/api/devices")
def get_devices(user=Depends(get_current_user)):
    groups = user.get("cognito:groups") or []
    if "admin" not in groups:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")
    return {"devices": list_latest_devices()}

########################
#### FINAL Assignment
########################

def _parse_ts(ts: str) -> datetime:
    # handles "2025-09-15T08:00:00+00:00"
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))

def _get_effective_device_id(device_id: str | None, user: dict) -> tuple[str, bool]:
    groups = user.get("cognito:groups") or []
    is_admin = "admin" in groups
    user_device = user.get("custom:device_id")

    if is_admin:
        if not device_id:
            raise HTTPException(status_code=400, detail="Missing required query parameter: device_id")
        return device_id, True

    if not user_device:
        raise HTTPException(status_code=403, detail="User has no custom:device_id claim; access denied")
    return user_device, False

@app.get("/api/latest")
def latest_table(
    device_id: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=2000),
    user=Depends(get_current_user),
):
    effective_device_id, is_admin = _get_effective_device_id(device_id, user)

    payload = read_latest_device_json(effective_device_id)
    records = payload.get("records", [])

    # sort by timestamp desc
    records_sorted = sorted(records, key=lambda r: _parse_ts(r["timestamp"]), reverse=True)
    return {
        "device_id": effective_device_id,
        "is_admin": is_admin,
        "count": len(records),
        "records": records_sorted[:limit],
    }

def _to_float(x, default: float = 0.0) -> float:
    try:
        return float(x)
    except Exception:
        return default
    
@app.get("/api/trend")
def trend(
    device_id: str | None = Query(default=None),
    bucket: str = Query(default="day"),  # "day" or "hour"
    user=Depends(get_current_user),
):
    """
    Sales trend computed as:
      total_value per bucket = sum(qty * unit_price)
      total_qty per bucket   = sum(qty)
    where qty and unit_price may be strings in the JSON records.
    """
    effective_device_id, is_admin = _get_effective_device_id(device_id, user)

    payload = read_latest_device_json(effective_device_id)
    records = payload.get("records", [])

    if bucket not in ("day", "hour"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="bucket must be 'day' or 'hour'")

    agg_value = defaultdict(float)
    agg_qty = defaultdict(float)

    for r in records:
        ts_raw = r.get("timestamp")
        if not ts_raw:
            continue

        ts = _parse_ts(ts_raw)
        key = ts.strftime("%Y-%m-%d") if bucket == "day" else ts.strftime("%Y-%m-%d %H:00")

        qty = _to_float(r.get("qty", 0))
        unit_price = _to_float(r.get("unit_price", 0))

        agg_qty[key] += qty
        agg_value[key] += qty * unit_price

    series = [
        {
            "bucket": k,
            "total_qty": round(agg_qty[k], 2),
            "total_value": round(agg_value[k], 2),
        }
        for k in sorted(agg_value.keys())
    ]

    return {
        "device_id": effective_device_id,
        "is_admin": is_admin,
        "bucket": bucket,
        "series": series,
    }

@app.get("/api/device-counts")
def device_counts(user=Depends(get_current_user)):
    groups = user.get("cognito:groups") or []
    is_admin = "admin" in groups
    user_device = user.get("custom:device_id")

    if not is_admin:
        if not user_device:
            raise HTTPException(status_code=403, detail="User has no custom:device_id claim; access denied")
        payload = read_latest_device_json(user_device)
        return {"devices": [{"device_id": user_device, "record_count": len(payload.get("records", []))}]}

    devices = list_latest_devices()
    out = []
    for d in devices:
        payload = read_latest_device_json(d)
        out.append({"device_id": d, "record_count": len(payload.get("records", []))})

    # sort desc by count
    out.sort(key=lambda x: x["record_count"], reverse=True)
    return {"devices": out}




