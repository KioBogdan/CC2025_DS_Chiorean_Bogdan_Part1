# 🌐 Cloud Computing Project (Parts 1–3)

This repository contains the semester Cloud Computing project, implemented incrementally in:
- **Part 1:** Cloud-deployed Web App (React + FastAPI on Azure App Service)
- **Part 2:** ETL pipeline + Serverless notification (Azure Data Factory + Azure Function + Teams)
- **Part 3:** Security, IAM & monitoring (AWS Cognito auth + JWT-protected API + role separation)

> Branches:
- `main` → baseline Part 1 (and early P2 artifacts)
- `a3-secured` → Part 3 security changes (JWT, Cognito, protected endpoints)
- `final` → used later for the final integrated system (Parts 1–3 + final requirements)

---

## ✅ Features (what works)

### Part 1 (Web App on Azure)
- React frontend with a “Connect backend” test button
- FastAPI backend with REST endpoints
- CORS configuration for FE ↔ BE communication
- CI/CD via GitHub Actions to Azure App Service

### Part 2 (ETL + Function + Teams)
- Raw CSV uploaded to **Blob Storage** (`raw/`)
- **Azure Data Factory** pipeline transforms CSV → per-device JSON output:
  - `processed/latest/device-<id>.json` (overwritten each run)
  - `processed/by-timestamp/<timestamp>/device-<id>.json` (history)
- **Azure Function (Blob Trigger)** validates output and posts **success/failure** notification to **Microsoft Teams Workflow** (HTTP)

### Part 3 (Security + IAM + Monitoring)
- **AWS Cognito User Pool** authentication (Amplify Auth in React)
- Backend requires **JWT** for protected endpoints:
  - `GET /api/profile` → returns resolved claims (role + device_id)
  - `GET /api/data` → returns device data with role separation
- Role separation:
  - **Admin** can query any device
  - **User** can only access their assigned `custom:device_id`
- Basic logging for auth/requests (visible in logs)

---

## 🧱 Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | React (Create React App) |
| Backend | FastAPI (Python) |
| ETL | Azure Data Factory (Pipeline + Mapping Data Flow) |
| Storage | Azure Blob Storage (raw/ & processed/) |
| Serverless | Azure Functions (Blob trigger + Teams notification) |
| Security | AWS Cognito (User Pools) + JWT validation |
| Deployment | Azure App Service (FE + BE) |
| CI/CD | GitHub Actions |

---

## 🗂️ Repository Structure

- `FE/my-frontend/` → React app (charts + login)
- `BE/` → FastAPI app (JWT validation + Blob reads)
- `.github/workflows/` → CI/CD workflows (Azure deploy)
---

# 🧪 Local Development

## Frontend (React)
```bash
cd FE/my-frontend
npm install
npm start
```

Create `FE/my-frontend/.env`:
```env
REACT_APP_AZURE_URL=http://localhost:8000
REACT_APP_AWS_REGION=eu-north-1
REACT_APP_COGNITO_USER_POOL_ID=<your_pool_id>
REACT_APP_COGNITO_CLIENT_ID=<your_client_id>
```

## Backend (FastAPI)
```bash
cd BE
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Create `BE/.env`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# Cognito (Part 3)
AWS_REGION=eu-north-1
COGNITO_USER_POOL_ID=<your_pool_id>
COGNITO_APP_CLIENT_ID=<your_client_id>

# Azure Storage (used by backend to read processed JSON)
AZURE_STORAGE_CONNECTION_STRING=<storage_connection_string>
AZURE_PROCESSED_CONTAINER=processed
AZURE_LATEST_PREFIX=latest
```

---

# ☁️ Azure Deployment Overview

The app is deployed to Azure App Services using GitHub Actions.

- frontend: `https://<frontend-app>.azurewebsites.net`
- backend: `https://<backend-app>.azurewebsites.net`

### Important (React env vars)
For CRA builds, `REACT_APP_*` variables must exist **at build time** in the GitHub Actions workflow. (They are embedded into the built static bundle.)

---

# 🏗️ Part 2 – ETL + Function (Azure Focus)

## ETL Flow (high level)
1) Upload CSV into Blob container `raw/`
2) ADF pipeline triggers and produces per-device JSON into `processed/`:
   - `latest/device-<id>.json`
   - `by-timestamp/<timestamp>/device-<id>.json`
3) Azure Function triggers on `processed/` and posts a Teams notification (success/failure)

## Teams Workflow
Create a Teams workflow:
**“When HTTP request received → Post message in a channel”**, then store the generated URL in Function App settings as:
```env
TEAMS_FLOW_URL=<workflow_http_url>
```

## What to commit for Part 2 (required)
- **ADF pipeline definition** (JSON export)
- **Azure Function source code**
- **Sample input + output for at least 2 devices**
- **Diagrams**:
  - Conceptual architecture diagram
  - UML deployment diagram (pipeline + function + storage)

---

# 🔐 Part 3 – Security, IAM & Monitoring

## Auth model
- Users authenticate using **AWS Cognito User Pool**
- JWT includes:
  - role / group (`admin` vs `user`)
  - `custom:device_id` claim used for authorization

## Protected endpoints
- `GET /api/profile`
  - returns resolved role + device_id claims (for UI display)
- `GET /api/data`
  - requires JWT
  - admin can query any device
  - user is restricted to own device_id

## Monitoring/logging
- Auth and request events are logged (successful logins, JWT failures, 401/403 responses)

---

# ✅ Testing Checklist (Parts 1–3)

## Part 1
- FE loads and “Connect backend” shows success message (200 OK)

## Part 2
- Upload CSV to `raw/`
- Confirm ADF run succeeds (Monitor)
- Confirm `processed/latest/` and `processed/by-timestamp/` contain per-device JSON
- Confirm Teams message arrives (success/failure)

## Part 3
- Login in FE works
- UI displays claims (admin/user + device_id)
- `GET /api/profile` returns claims (JWT required)
- `GET /api/data`:
  - without JWT → 401
  - with valid JWT:
    - admin → access any device
    - user → only own device_id

---
