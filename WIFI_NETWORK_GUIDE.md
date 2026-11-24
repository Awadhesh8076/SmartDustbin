# SmartDustbin — Wi-Fi Network & ESP32 Commissioning Guide

This manual covers the Wi-Fi Station Mode setup and DHCP commissioning process for the **ESP32-CAM** and **ESP32 DevKit** microcontrollers.

---

## 1. Network Architecture: Why Station Mode with DHCP?

Older configurations often used hardcoded static IPs (such as `192.168.4.10` and `192.168.4.20`). However, home, office, and mobile hotspot routers assign IP addresses dynamically on different subnets (e.g., `192.168.1.x`, `192.168.0.x`, or `10.0.4.x`).

By configuring both microcontrollers in **Wi-Fi Station Mode (STA) with DHCP**:
1. Both boards reliably join your existing local network without IP conflicts.
2. The router assigns a valid local IP address automatically.
3. The actual assigned IP addresses are printed to the Serial Monitor at boot.
4. You configure the assigned IPs directly in the SmartDustbin web UI (*Device Management* page), and they are saved to the SQLite database.

---

## 2. Flashing the Microcontrollers

### A. ESP32-CAM (AI-Thinker OV2640)
- **Source Code:** [firmware/ESP32_CAM/ESP32_CAM_Capture.ino](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/firmware/ESP32_CAM/ESP32_CAM_Capture.ino)
- **Arduino IDE Board Settings:**
  - Board: `AI Thinker ESP32-CAM`
  - CPU Frequency: `240MHz (WiFi/BT)`
  - Flash Frequency: `80MHz`
  - Flash Mode: `QIO`
  - Partition Scheme: `Huge APP (3MB No OTA/1MB SPIFFS)`
  - PSRAM: `Enabled`
  - Upload Speed: `115200`
- **Steps:**
  1. Open `firmware/ESP32_CAM/ESP32_CAM_Capture.ino`.
  2. Update lines 18-19 with your actual Wi-Fi credentials:
     ```cpp
     const char* ssid = "YOUR_WIFI_SSID";
     const char* password = "YOUR_WIFI_PASSWORD";
     ```
  3. Connect the ESP32-CAM via an FTDI programmer (connect `GPIO 0` to `GND` during flashing).
  4. Click **Upload**. When done, disconnect `GPIO 0` from `GND` and press the Reset button.

### B. ESP32 DevKit V1 (Dual-Servo Sorter)
- **Source Code:** [firmware/ESP32_DevKit/ESP32_DevKit_Sorter.ino](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/firmware/ESP32_DevKit/ESP32_DevKit_Sorter.ino)
- **Library Required:** `ESP32Servo` by Kevin Harrington (install via Arduino Library Manager).
- **Arduino IDE Board Settings:**
  - Board: `DOIT ESP32 DEVKIT V1` (or `ESP32 Dev Module`)
  - Upload Speed: `921600` or `115200`
- **Steps:**
  1. Open `firmware/ESP32_DevKit/ESP32_DevKit_Sorter.ino`.
  2. Update lines 19-20 with your Wi-Fi credentials:
     ```cpp
     const char* ssid = "YOUR_WIFI_SSID";
     const char* password = "YOUR_WIFI_PASSWORD";
     ```
  3. Connect the DevKit via micro-USB and click **Upload**.

---

## 3. Discovering Assigned IP Addresses

Once flashed and booted, both boards will connect to your Wi-Fi and print their network details.

### Method 1: Arduino Serial Monitor (Fastest)
1. In Arduino IDE, open **Tools -> Serial Monitor**.
2. Set the baud rate to **`115200 baud`**.
3. Press the **EN / RST** button on the ESP32 board.
4. You will see a diagnostic banner:

```text
==================================================
 Smart Dustbin - ESP32-CAM (Station / DHCP Mode) 
==================================================
[WIFI] Connecting to Wi-Fi SSID: MyHomeWiFi
.....
[WIFI] Connected successfully via DHCP!
[WIFI] Assigned IP Address: 192.168.1.45
[WIFI] Subnet Mask: 255.255.255.0
[WIFI] Gateway IP: 192.168.1.1
[WIFI] RSSI Signal: -52 dBm
--------------------------------------------------
[INFO] Web UI root URL:    http://192.168.1.45/
[INFO] Snapshot capture:   http://192.168.1.45/capture
[INFO] Health status JSON: http://192.168.1.45/status
--------------------------------------------------
[SERVER] ESP32-CAM HTTP Server active on port 80.
```

### Method 2: Wi-Fi Router Admin Portal
1. Open your router management page in your browser (typically `http://192.168.1.1` or `http://192.168.0.1`).
2. Navigate to **DHCP Client List** or **Attached Devices**.
3. Look for devices named `espressif` or matching the ESP32 MAC addresses.

### Method 3: Mobile Hotspot Connected Devices
If commissioning using a smartphone hotspot:
1. Open phone **Settings -> Portable Hotspot -> Connected Devices**.
2. View the assigned IP for each connected ESP32 client.

---

## 4. Critical Wi-Fi Troubleshooting Checklist

| Issue | Cause | Solution |
|---|---|---|
| **Board cannot connect to Wi-Fi** | Network is 5 GHz only | ESP32 hardware only supports **2.4 GHz** Wi-Fi. Enable 2.4 GHz band in your router settings. |
| **Laptop cannot reach ESP32 IP** | **AP Isolation (Client Isolation)** enabled on router | Log in to router settings and **Disable AP Isolation / Client Isolation**. When enabled, Wi-Fi devices cannot talk to each other. |
| **ESP32-CAM keeps rebooting** | `Brownout detector was triggered` | The camera module draws up to 350mA during Wi-Fi transmission. Power via a **5V 2A external power supply**, not a laptop USB port. |
| **Capture returns truncated bytes** | Insufficient PSRAM buffer | In Arduino IDE, ensure **PSRAM: Enabled** is selected under Tools. |
| **Connection Timed Out (HTTP 504)** | Windows Firewall blocking | Add inbound firewall rules on laptop for ports 8000 and 5173 (see [WINDOWS_SETUP_GUIDE.md](file:///C:/Users/Awadhesh/Desktop/SmartDustbin/WINDOWS_SETUP_GUIDE.md)). |
