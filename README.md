# 🌐 Cloudl Computing - Part 1
  
Part 1 of the Cloud Computing semester project demonstrates a simple frontend-backend connection deployed on Azure, using **Azure App Services**.

---

## 🚀 Features

- React frontend with simple backend connection button
- FastAPI backend serving REST endpoints
- CORS-enabled secure communication
- Continuous deployment via GitHub Actions to Azure

---

## 🧱 Tech stack

| Layer | Technology |
|-------|-------------|
| Frontend | React (Create React App) |
| Backend | FastAPI (Python) |
| Deployment | Azure App Service (Linux) |
| CI/CD | GitHub Actions |

---

## 🧩 Project structure
- /FE/my-frontend/ → React app
- /BE → FastAPI app
- .github/workflows → CI/CD pipelines
  
---

## 🧭 Local Development

### Frontend
-> cd FE/my-frontend
-> npm install
-> npm start

### Backend
-> cd BE
-> pip install -r requirements.txt
-> uvicorn main:app --reload

### In order to run the application locally, the user must set the following environment variable, inside a .env file in the BE:
-- ALLOW_ORIGINS=http://localhost:3000, http://localhost:8000 -- 

### Adding to it, in the frontend folder, the user must create another .env file, with the following:
REACT_APP_AZURE_URL=http://localhost:8000

## ☁️ Deployment Overview

-> The app is deployed to Azure App Services using GitHub Actions.

- frontend: cc2025-ui-2.****.azurewebsites.net
- backend: cc2025-api-2.****.azurewebsites.net





