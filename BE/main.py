from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware #cors policies

#Create FastAPI app instance
app = FastAPI()

# --------  CORS config ------------
origins = [
    "http://localhost:3000",  # The default port for create-react-app
    "localhost:3000"
]

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
