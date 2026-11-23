# SmartDustbin — Troubleshooting & Diagnostic Guide

This document lists common issues, diagnostic procedures, error codes, and resolution steps for both software and hardware tiers.

---

## 1. Quick Diagnostic Checklist

| Symptom | Diagnostic Step | Resolution |
|---|---|---|
| **FastAPI fails to start** | Run `.\backend\venv\Scripts\python.exe -m pytest` | Ensure Python 3.14 venv has all dependencies installed from `requirements.txt`. |
| **Frontend blank or 404** | Check Vite dev server output or inspect console | Verify Node version $\ge 18$ and run `npm run build` to detect TypeScript compilation issues. |
| **All scans return UNKNOWN** | Check `/api/learning/samples` | Expected behavior on fresh installs: Pearson similarity threshold is $r \ge 0.70$. Use the 4 labeled teaching buttons to teach categories. |
| **ESP32-CAM capture times out** | Test ping in Device Management | Verify ESP32-CAM is powered, connected to same WiFi subnet, and reachable at configured IP. |
| **DevKit returns 429 BUSY** | Check serial monitor at 115200 baud | The dual-servo sorting routine takes $2.7\text{ s}$. Wait until the current cycle finishes before triggering another sort. |
| **Coins not credited** | Verify sorting command status | Coins are credited **strictly** upon confirmed sorting success, never on scan, UNKNOWN items, or failed sort cycles. |

---

## 2. Hardware Diagnostics

### A. ESP32 DevKit Dual Servos Not Moving
1. **Power Check:** Are the servos connected to a dedicated 5V power supply rail? High-torque servos (MG996R or SG90) draw up to $500\text{ mA} - 1\text{ A}$ under load, causing the ESP32 to brownout/reset if powered from the 3.3V pin.
2. **Common Ground:** Is the external power supply ground connected to the ESP32 DevKit GND pin? Without a common ground reference, the PWM signal on GPIO 18 and 19 will not be interpreted.
3. **Serial Monitor:** Open Arduino Serial Monitor at `115200` baud. Look for:
   ```text
   [SERVO 1] Rotating selector to 90 deg
   [SERVO 2] Opening release flap to 90 deg
   ```

### B. ESP32-CAM Returning Corrupt Images
1. **Camera Cable:** Check that the ribbon cable of the OV2640 sensor is firmly seated and locked into the FPC connector.
2. **Brownout:** The OV2640 requires significant instantaneous current during JPEG capture. Ensure adequate decoupling capacitors ($100\mu\text{F}$ across 5V and GND) are present.
3. **Header Validation:** The backend automatically rejects frames without the `0xFF 0xD8` JPEG magic bytes.

---

## 3. Network & Connection Diagnostics

### Probe Commands from PowerShell:
```powershell
# 1. Test Backend Health
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health"

# 2. Test Microcontroller Reachability from Host
Test-NetConnection -ComputerName "192.168.4.10" -Port 80
Test-NetConnection -ComputerName "192.168.4.20" -Port 80

# 3. Test DevKit Status Endpoint
Invoke-RestMethod -Uri "http://192.168.4.20/status"
```

---

## 4. Error Code Reference

| Status Code | Error Message | Explanation |
|---|---|---|
| **`400 Bad Request`** | `"Uploaded file must be a valid image"` | File MIME type or magic bytes did not match JPEG, PNG, or WebP. |
| **`400 Bad Request`** | `"Cannot sort category UNKNOWN"` | System enforces zero-guessing policy; UNKNOWN waste cannot be physically actuated. |
| **`400 Bad Request`** | `"Insufficient coins"` | Spendable balance is lower than the cost of the requested Eco Store reward. |
| **`404 Not Found`** | `"Reward '...' not found in catalog"` | Invalid reward ID requested. Allowed IDs: `R1`, `R2`, `R3`, `R4`. |
| **`429 Too Many Requests`** | `"DevKit Sorter is currently busy"` | Sorter is currently executing another 2.7s physical cycle. |
| **`502 Bad Gateway`** | `"Invalid JPEG header received from ESP32-CAM"` | Camera returned truncated or corrupted buffer. |
| **`504 Gateway Timeout`** | `"Timeout awaiting ESP32 DevKit confirmation"` | Hardware command outcome is UNKNOWN. System prevents automatic retries for physical safety. |
