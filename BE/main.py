from fastapi import FastAPI, Depends, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware #cors policies
from dotenv import load_dotenv
from auth import get_current_user
from storage import read_latest_device_json, list_latest_devices
import os

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





