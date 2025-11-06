from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware #cors policies
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Read allowed origins from environment
origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

app = FastAPI() #Create fastAPI instance


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)
# ----------------------------------

#API endpoint
@app.get("/api/connect")
async def root():
    return {"message": "Succesfully connected to backend"}
