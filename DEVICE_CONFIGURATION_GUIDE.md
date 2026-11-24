# SmartDustbin — Web Device Configuration & Hardware Diagnostics Guide

This guide walks you through using the **IoT Device Management** page in the SmartDustbin web application to configure microcontrollers, run connection diagnostics, view real camera captures, and test physical servo sorting.

---

## 1. Accessing the Device Management Page

1. Start the system via `.\start-smartdustbin.ps1` (or open [http://localhost:5173](http://localhost:5173)).
2. From the sidebar navigation menu, click **Device Management** (or navigate to `/devices`).

---

## 2. Configuring Microcontroller IP Addresses

On the Device Management page, you will see two hardware configuration cards:

### A. ESP32-CAM Configuration
1. Enter the assigned DHCP IP address from your Serial Monitor (e.g. `192.168.1.45`) in the **Camera Assigned Wi-Fi IP Address** field.
2. Set the **HTTP Capture Timeout** (default `5` seconds; increase to `8-10` if on high-latency Wi-Fi).

### B. ESP32 DevKit Configuration
1. Enter the assigned DHCP IP address from your Serial Monitor (e.g. `192.168.1.52`) in the **DevKit Assigned Wi-Fi IP Address** field.
2. Set the **HTTP Actuation Timeout** (default `12` seconds to accommodate the full $2.7\text{ s}$ dual-servo cycle).

### C. Saving Settings
- Click the green **Save IP Settings** button at the top right.
- The new IP addresses are validated and permanently written to the SQLite database.

---

## 3. Testing the ESP32-CAM Connection

### Test 1: Ping Probe (`GET /`)
- Click **Test Probe (GET /)** on the ESP32-CAM card.
- FastAPI sends a lightweight HTTP ping to `http://<CAM_IP>/`.
- If reachable, the dashboard displays:
  `[CAM DIAGNOSTIC] Online: Reachable (45.2ms)`

### Test 2: Live JPEG Capture (`GET /capture`)
- Click **Capture Test Frame**.
- FastAPI queries `http://<CAM_IP>/capture` on the camera.
- The web application renders the **actual live JPEG image** directly in the browser with:
  - Byte count received (e.g. `42,810 bytes`).
  - Image format (`JPEG`).
  - Source endpoint URL.
- Click **Run AI Classification** underneath the image to pass the captured frame directly into the TinyML AI classification engine and view real-time confidence and category prediction.

---

## 4. Testing the ESP32 DevKit & Physical Dual Servos

### Test 1: Sorter Status Probe (`GET /status`)
- Click **Ping DevKit Status (GET /status)** on the ESP32 DevKit card.
- If reachable, the dashboard confirms:
  `[DEVKIT DIAGNOSTIC] Online: Reachable (32.1ms)`

### Test 2: Confirmed Physical Sorting Test
The DevKit card includes a dedicated **Physical Servo Actuation Test** panel:

1. Select a category button:
   - **`PLASTIC`**: 360° continuous servo rotates to Compartment 1 (CW 400ms).
   - **`METAL`**: 360° continuous servo rotates to Compartment 2 (CW 800ms).
   - **`WET`**: 360° continuous servo rotates to Compartment 3 (CW 1200ms).
   - **`DRY`**: 360° continuous servo rotates to Compartment 4 (CW 1600ms).
2. Click **Actuate Physical [CATEGORY] Sort**.
3. FastAPI generates a unique command UUID and sends:
   `GET http://<DEVKIT_IP>/sort?type=CATEGORY&command_id=test-UUID`
4. The DevKit moves the physical servos:
   - 360° Continuous Servo rotates clockwise to the selected bin.
   - Positional 180° Flap Servo opens to 90° for 1.2 seconds, then closes.
   - 360° Continuous Servo returns counter-clockwise back to the Home position.
5. The web interface displays a green confirmation:
   `Physical sorting test confirmed by ESP32 DevKit at 192.168.1.52: Physical sorting completed successfully.`

---

## 5. Switching Between Simulation & Real Hardware Modes

At the top of the Device Management page, an active mode banner indicates the operating state:

### Simulation Mode (Default)
- **Safe commissioning mode**: All camera captures, AI detection frames, and dual-servo sequences run virtually.
- You can still use the **Test Probe**, **Capture Test Frame**, and **Actuate Physical Sort** buttons to test your real hardware while the rest of the application remains in simulation!

### Real Hardware Mode
- Click **Enable Real Hardware Mode**.
- In Real Hardware Mode, the application directly queries the physical microcontrollers during normal scanning and sorting operations.
- **Zero Silent Fallback**: If a board is unplugged or out of range, the application will **not** silently fake a result. Instead, it will display an explicit diagnostic error indicating whether the connection timed out, was refused, or failed to return valid image data.
