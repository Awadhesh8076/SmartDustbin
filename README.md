# SmartDustbin — AI & IoT Web Platform

SmartDustbin is an end-to-end AI-powered waste classification, dual-servo mechanical sorting simulation, and verified reward economy web application. It completely replaces the legacy Unity mobile application with a modern, high-performance web architecture built with **FastAPI**, **React**, **SQLite**, and **OpenCV / NumPy**.

---

## Key Features

1. **Exact 32-D TinyML Feature Extraction**:
   - 100% mathematical port of the original Unity C# TinyML algorithm.
   - 8 Hue histogram bins, 4 Saturation bins, 4 Value bins, 4 Quadrant mean hues, 4 Quadrant mean saturations, 4 Quadrant edge energies, specular reflectance, chlorophyll index, total edge energy, and color variance.
   - Mean-centered and unit-normalized into Pearson standard space ($\sum \hat{F}_i = 0$, $\|\hat{F}\| = 1$).

2. **Strict Zero-Guessing Policy**:
   - Similarity $r < 0.70$ is classified as `UNKNOWN` ($0.0\%$ confidence).
   - Unknown waste is prevented from physical actuation.
   - 1-Shot online centroid adaptation allows users to teach the model immediately ($C_{\text{new}} = \frac{C_{\text{old}} \cdot N + F}{N + 1}$).

3. **Dual-Servo Actuation & Virtual Mechanism**:
   - **Servo 1 (Chute Selector, GPIO 18):** Plastic $45^\circ$, Metal $90^\circ$, Wet $135^\circ$, Dry $180^\circ$, Home $0^\circ$.
   - **Servo 2 (Trapdoor Release Flap, GPIO 19):** Closed $0^\circ$, Open $90^\circ$ for $1,200\text{ ms}$.
   - Full $2,700\text{ ms}$ routine mirroring ESP32 DevKit firmware.

4. **Verified Anti-Duplicate Reward Economy**:
   - Metal: $+5$ Coins, Plastic: $+3$ Coins, Dry: $+2$ Coins, Wet: $+1$ Coin.
   - Coins awarded **strictly** upon confirmed sorting success; database unique constraints prevent double credits.
   - In-app Eco Store with instant digital voucher generation (`ECO-XXXXX`).

5. **Dual Operating Modes**:
   - **Simulation Mode (Default):** Runs completely standalone without physical hardware.
   - **Real Hardware Mode:** FastAPI acts as the exclusive mediator for ESP32-CAM (`192.168.4.10:80`) and ESP32 DevKit (`192.168.4.20:80`).

---

## Quick Start (Windows PowerShell)

### One-Click Launch
```powershell
.\run_all.ps1
```
*Starts both backend and frontend in separate terminal windows and opens your default browser at `http://localhost:5173`.*

### Manual Startup

#### 1. Backend Server
```powershell
cd C:\Users\Awadhesh\Desktop\SmartDustbin
.\backend\venv\Scripts\python.exe backend\run.py
```
- API Endpoint: `http://127.0.0.1:8000`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`

#### 2. Frontend Development Server
```powershell
cd C:\Users\Awadhesh\Desktop\SmartDustbin\frontend
npm run dev
```
- Web Application: `http://localhost:5173`

#### 3. Run Automated Tests
```powershell
cd C:\Users\Awadhesh\Desktop\SmartDustbin
.\backend\venv\Scripts\pytest.exe backend\tests -v
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons | Responsive SPA web UI |
| **Backend** | Python 3.14, FastAPI, Uvicorn | RESTful API & hardware proxy |
| **Database** | SQLite 3, SQLAlchemy ORM | ACID persistence & audit trail |
| **AI / ML** | NumPy, OpenCV (cv2), Pillow | 32-D feature extraction & online learning |
| **Hardware** | ESP32-CAM (OV2640), ESP32 DevKit V1 | Image capture & dual-servo control |

---

## Documentation Index

- [Architecture Overview](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/SMARTDUSTBIN_ARCHITECTURE.md)
- [Hardware Setup & Wiring](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/HARDWARE_SETUP.md)
- [API Reference & Endpoints](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/API_DOCUMENTATION.md)
- [Database Schema & Backup](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/DATABASE_DOCUMENTATION.md)
- [AI Engine & TinyML Documentation](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/AI_MODEL_DOCUMENTATION.md)
- [Automated Testing Report](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/TESTING_REPORT.md)
- [Production Deployment Guide](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/DEPLOYMENT_GUIDE.md)
- [Troubleshooting & Diagnostics](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/TROUBLESHOOTING.md)
- [Development Progress Log](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/DEVELOPMENT_PROGRESS.md)
