# SmartDustbin — Production Deployment & Operations Guide

This guide details the deployment options, environment configuration, system requirements, and maintenance operations for the SmartDustbin platform.

---

## 1. System Requirements

### Host Environment:
- **Operating System:** Windows 10/11, Ubuntu 22.04 LTS+, or macOS.
- **Python:** Python 3.10 to 3.14 (Python 3.14.6 verified in project virtual environment).
- **Node.js:** Node.js v18+ (Node v24.12.0 with npm 11.6.2 verified).
- **RAM:** Minimum 2GB (4GB recommended).
- **Disk Space:** 500MB for application and dependencies.

---

## 2. Windows On-Premises / Local Edge Deployment (Recommended)

Since the ESP32 microcontrollers communicate over local network WiFi (`192.168.4.x`), deploying the FastAPI backend and React frontend directly on the local host/gateway computer is the most practical architecture.

### Step 1: Clone & Configure
```powershell
Set-Location -Path "C:\Users\Awadhesh\Desktop\SmartDustbin"

# Copy environment configuration
Copy-Item "backend\.env.example" "backend\.env"
```

### Step 2: Build the Frontend for Production
```powershell
Set-Location -Path "frontend"
npm install
npm run build
```
This generates the optimized production bundle in `frontend/dist/`.

### Step 3: Run FastAPI Serving Production Assets
The backend can serve the API and static frontend assets simultaneously:
```powershell
Set-Location -Path "C:\Users\Awadhesh\Desktop\SmartDustbin"
.\backend\venv\Scripts\python.exe backend\run.py
```

### Step 4: Automate Startup via Windows Task Scheduler or Script
Use the provided one-click launch script:
```powershell
.\run_all.ps1
```

---

## 3. Remote / Cloud Deployment Considerations

If the backend and frontend are deployed to a cloud server (e.g. AWS, DigitalOcean, Render, or Railway):
- **ESP32 Reachability Limitation:** The physical ESP32 microcontrollers on private IP `192.168.4.x` cannot be directly reached by a public cloud server without a VPN tunnel or local gateway.
- **Recommended Cloud Topology:**
  1. The cloud server hosts the React frontend and centralized analytics database.
  2. A local edge gateway (such as a Raspberry Pi or local PC running the SmartDustbin backend) proxies hardware commands to the ESP32 devices via MQTT or WebSocket.
  3. In **Simulation Mode**, the cloud deployment works 100% out of the box with zero hardware requirements.

---

## 4. Environment Variables (`.env`)

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `8000` | Port for FastAPI HTTP server |
| `HOST` | `127.0.0.1` | Host binding interface (`0.0.0.0` for LAN access) |
| `DEFAULT_MODE` | `SIMULATION` | Initial operating mode (`SIMULATION` or `REAL_HARDWARE`) |
| `DATABASE_URL` | `sqlite:///storage/smartdustbin.db` | SQLAlchemy SQLite database connection string |
| `DEFAULT_ESP32_CAM_IP` | `192.168.4.10` | Static IP of ESP32-CAM |
| `DEFAULT_ESP32_DEVKIT_IP` | `192.168.4.20` | Static IP of ESP32 DevKit |
| `DEFAULT_CAMERA_TIMEOUT` | `4.0` | Timeout in seconds for camera snapshot HTTP requests |
| `DEFAULT_DEVKIT_TIMEOUT` | `10.0` | Timeout in seconds for sorting actuation HTTP requests |

---

## 5. Security & Maintenance Operations

1. **Database Backups:**
   Schedule regular backups by sending an HTTP POST request:
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/settings/backup" -Method Post
   ```
2. **Database Integrity Check:**
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/settings/database-health"
   ```
3. **Log Rotation:**
   Stored camera scans in `storage/scans/` can be archived or purged periodically according to your data retention policy.
