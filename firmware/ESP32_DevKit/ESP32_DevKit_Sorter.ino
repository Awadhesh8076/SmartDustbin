/*
 * =========================================================================
 * Smart Dustbin - ESP32 DevKit Dual-Servo Sorter (CALIBRATED & FAILSAFE)
 * Board: ESP32 DevKit V1 (30 or 36 pins)
 * 
 * Hardware Wiring:
 *   - Continuous 360° Servo (Turntable / Chute): GPIO 18
 *   - Positional 180° Servo (Trapdoor Flap):      GPIO 19
 *   - Power: External 5V Supply (Share GND with ESP32!)
 * 
 * Wi-Fi Behavior:
 *   - Connects to your Wi-Fi/Hotspot (Default: Smartdustbin / Smartdustbin123)
 *   - FALLBACK AUTO-AP: If Wi-Fi fails to connect within 15 seconds,
 *     ESP32 automatically creates its own Hotspot:
 *     SSID: "SmartDustbin_Sorter" (Password: "12345678", IP: 192.168.4.1)
 *     You will NEVER be left without an IP or access!
 * =========================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ---------------- Wi-Fi Config ----------------
const char* STA_SSID     = "Smartdustbin";
const char* STA_PASSWORD = "Smartdustbin123";

// Failsafe AP Credentials (if STA fails)
const char* AP_SSID      = "SmartDustbin_Sorter";
const char* AP_PASSWORD  = "12345678";

WebServer server(80);

// ---------------- Servo Pins ----------------
#define SERVO_360_PIN 18  // Continuous-Rotation 360° Chute Servo
#define SERVO_180_PIN 19  // Positional 180° Trapdoor Flap Servo

Servo servo360Chute;
Servo servo180Trapdoor;

/*
 * =========================================================================
 * CALIBRATION CONSTANTS
 * =========================================================================
 * 360° Continuous Servo Control:
 *   - 1500 us = Neutral Stop (hold still)
 *   - 1000 us = Full Clockwise (CW) Rotation
 *   - 2000 us = Full Counter-Clockwise (CCW) Rotation
 *
 * 180° Positional Trapdoor Servo Control:
 *   - 0 degrees  = Flap Closed (Holding item)
 *   - 60 degrees = Flap Open (Dumps item into bin compartment)
 *   - (Never flaps both sides; strictly moves 0° -> 60° -> 0°)
 */
const int SERVO_360_STOP_US = 1500;  // Neutral pulse (Stop)
const int SERVO_360_CW_US   = 1000;  // Full speed CW forward
const int SERVO_360_CCW_US  = 2000;  // Full speed CCW return

const int TRAPDOOR_CLOSED_DEG = 0;   // Rest / Closed
const int TRAPDOOR_OPEN_DEG   = 60;  // Dump position (~60°)
const int FLAP_DUMP_HOLD_MS   = 1000; // Hold open for item to drop

// Calibrated travel time (ms) to reach each compartment from Home:
const int TRAVEL_PLASTIC_MS = 450;   // Compartment 1
const int TRAVEL_METAL_MS   = 900;   // Compartment 2
const int TRAVEL_WET_MS     = 1350;  // Compartment 3
const int TRAVEL_DRY_MS     = 1800;  // Compartment 4

// Calibration offset (tune if return doesn't land exactly at home)
// e.g. 1.0 = equal return time, 0.98 or 1.02 for minor friction differences
const float RETURN_TIME_FACTOR = 1.00;

// State management
volatile bool isBusy = false;
String currentTask = "IDLE";
String activeIP = "";

// ---------------- Actuation Pipeline ----------------
bool executeSortingCycle(String category) {
  category.toUpperCase();
  isBusy = true;
  currentTask = "SORTING_" + category;
  Serial.printf("\n=========================================\n");
  Serial.printf("[SORT CYCLE START] Target: %s\n", category.c_str());

  int travelDuration = 0;
  if (category == "PLASTIC")      travelDuration = TRAVEL_PLASTIC_MS;
  else if (category == "METAL")   travelDuration = TRAVEL_METAL_MS;
  else if (category == "WET")     travelDuration = TRAVEL_WET_MS;
  else if (category == "DRY")     travelDuration = TRAVEL_DRY_MS;
  else {
    Serial.println("[ERROR] Unknown category! Aborting.");
    isBusy = false;
    currentTask = "IDLE";
    return false;
  }

  // Ensure trapdoor is strictly CLOSED before starting travel
  servo180Trapdoor.write(TRAPDOOR_CLOSED_DEG);
  delay(150);

  // 1. Rotate 360° Continuous Chute CW to target compartment
  Serial.printf("[STAGE 1] Chute rotating CW to %s for %d ms...\n", category.c_str(), travelDuration);
  servo360Chute.writeMicroseconds(SERVO_360_CW_US);
  delay(travelDuration);

  // 2. Stop Chute & hold position over target compartment
  servo360Chute.writeMicroseconds(SERVO_360_STOP_US);
  Serial.println("[STAGE 2] Chute arrived. Stabilizing (300 ms)...");
  delay(300);

  // 3. Open 180° Trapdoor Flap to 60° to dump item
  Serial.printf("[STAGE 3] Opening trapdoor flap to %d deg to dump...\n", TRAPDOOR_OPEN_DEG);
  servo180Trapdoor.write(TRAPDOOR_OPEN_DEG);
  delay(FLAP_DUMP_HOLD_MS); // Allow item to slide/fall through

  // 4. Close 180° Trapdoor Flap back to 0°
  Serial.printf("[STAGE 4] Closing trapdoor flap back to %d deg...\n", TRAPDOOR_CLOSED_DEG);
  servo180Trapdoor.write(TRAPDOOR_CLOSED_DEG);
  delay(400); // Wait for flap to fully seal

  // 5. Rotate 360° Continuous Chute CCW back to Home position
  int returnDuration = (int)(travelDuration * RETURN_TIME_FACTOR);
  Serial.printf("[STAGE 5] Returning Chute CCW to Home for %d ms...\n", returnDuration);
  servo360Chute.writeMicroseconds(SERVO_360_CCW_US);
  delay(returnDuration);

  // 6. Complete Stop at Home position
  servo360Chute.writeMicroseconds(SERVO_360_STOP_US);
  delay(200);

  Serial.println("[SORT CYCLE COMPLETE] Ready for next command.");
  Serial.printf("=========================================\n\n");

  isBusy = false;
  currentTask = "IDLE";
  return true;
}

// ---------------- Calibration Test Endpoint ----------------
// Allows live tuning without re-flashing:
// e.g. /calibrate?servo=360&dir=cw&ms=500
// e.g. /calibrate?servo=180&angle=60
void handleCalibrate() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (isBusy) {
    server.send(429, "application/json", "{\"status\":\"BUSY\"}");
    return;
  }

  String servo = server.hasArg("servo") ? server.arg("servo") : "";
  if (servo == "180") {
    int angle = server.hasArg("angle") ? server.arg("angle").toInt() : 0;
    servo180Trapdoor.write(angle);
    server.send(200, "application/json", "{\"status\":\"SUCCESS\",\"servo\":180,\"angle\":" + String(angle) + "}");
    return;
  } else if (servo == "360") {
    String dir = server.hasArg("dir") ? server.arg("dir") : "stop";
    int ms = server.hasArg("ms") ? server.arg("ms").toInt() : 500;
    dir.toLowerCase();
    
    if (dir == "cw") servo360Chute.writeMicroseconds(SERVO_360_CW_US);
    else if (dir == "ccw") servo360Chute.writeMicroseconds(SERVO_360_CCW_US);
    else servo360Chute.writeMicroseconds(SERVO_360_STOP_US);

    if (dir == "cw" || dir == "ccw") {
      delay(ms);
      servo360Chute.writeMicroseconds(SERVO_360_STOP_US);
    }
    server.send(200, "application/json", "{\"status\":\"SUCCESS\",\"servo\":360,\"dir\":\"" + dir + "\",\"ms\":" + String(ms) + "}");
    return;
  }

  server.send(400, "application/json", "{\"status\":\"ERROR\",\"message\":\"Use ?servo=180&angle=60 or ?servo=360&dir=cw&ms=500\"}");
}

// ---------------- HTTP Endpoints ----------------
void handleSort() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");

  if (isBusy) {
    server.send(429, "application/json", "{\"status\":\"BUSY\",\"message\":\"Sorter is currently executing another cycle.\"}");
    return;
  }

  if (!server.hasArg("type")) {
    server.send(400, "application/json", "{\"status\":\"ERROR\",\"message\":\"Missing 'type' query parameter (e.g., ?type=PLASTIC)\"}");
    return;
  }

  String wasteType = server.arg("type");
  wasteType.toUpperCase();

  if (wasteType != "PLASTIC" && wasteType != "METAL" && wasteType != "WET" && wasteType != "DRY") {
    server.send(400, "application/json", "{\"status\":\"REJECTED\",\"message\":\"Invalid waste type. Expected PLASTIC, METAL, WET, or DRY.\"}");
    return;
  }

  // Respond IMMEDIATELY to prevent client HTTP socket timeouts, then run cycle:
  String json = "{\"status\":\"SUCCESS\",\"waste\":\"" + wasteType + "\",\"message\":\"Actuation sequence initiated successfully.\"}";
  server.send(200, "application/json", json);

  // Execute sequence synchronously now that response has reached client socket
  executeSortingCycle(wasteType);
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String json = "{\"device\":\"ESP32_DevKit_Sorter\","
                "\"status\":\"ONLINE\","
                "\"busy\":" + String(isBusy ? "true" : "false") + ","
                "\"task\":\"" + currentTask + "\","
                "\"ip\":\"" + activeIP + "\"}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<title>Smart Dustbin DevKit</title>"
    "<style>body{font-family:system-ui;padding:20px;line-height:1.6;background:#0f172a;color:#f8fafc;}"
    "a{display:inline-block;margin:6px 4px;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;}"
    ".btn-red{background:#dc2626;}.btn-green{background:#16a34a;}.btn-amber{background:#d97706;}.card{background:#1e293b;padding:16px;border-radius:8px;margin-bottom:16px;}"
    "</style></head><body>"
    "<h2>Smart Dustbin DevKit Sorter</h2>"
    "<div class='card'>"
    "<p>Status: <b>ONLINE</b> | Task: <b>" + currentTask + "</b></p>"
    "<p><a href='/status'>Status JSON (/status)</a></p>"
    "</div>"
    "<div class='card'>"
    "<h3>Direct Sorter Actuation:</h3>"
    "<a class='btn-amber' href='/sort?type=PLASTIC'>Sort PLASTIC</a>"
    "<a class='btn-red' href='/sort?type=METAL'>Sort METAL</a>"
    "<a class='btn-green' href='/sort?type=WET'>Sort WET</a>"
    "<a href='/sort?type=DRY'>Sort DRY</a>"
    "</div>"
    "<div class='card'>"
    "<h3>Live Calibration:</h3>"
    "<a href='/calibrate?servo=180&angle=60'>Open Flap (60 deg)</a>"
    "<a href='/calibrate?servo=180&angle=0'>Close Flap (0 deg)</a>"
    "<a href='/calibrate?servo=360&dir=cw&ms=450'>Chute CW 450ms</a>"
    "<a href='/calibrate?servo=360&dir=ccw&ms=450'>Chute CCW 450ms</a>"
    "</div>"
    "</body></html>";
  server.send(200, "text/html", html);
}

// ---------------- Setup ----------------
void setup() {
  // Disable brownout detector to prevent reboot when servos draw current
  #ifdef RTC_CNTL_BROWN_OUT_REG
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  #elif defined(RTC_CNTL_BROWNOUT_REG)
    WRITE_PERI_REG(RTC_CNTL_BROWNOUT_REG, 0);
  #endif

  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n========================================================");
  Serial.println("  Smart Dustbin - ESP32 DevKit Dual-Servo Sorter v2.0  ");
  Serial.println("========================================================");

  // Allocate PWM timers
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  servo360Chute.setPeriodHertz(50);
  servo180Trapdoor.setPeriodHertz(50);

  // Attach servos with standard 500-2400us limits
  servo360Chute.attach(SERVO_360_PIN, 500, 2400);
  servo180Trapdoor.attach(SERVO_180_PIN, 500, 2400);

  // Initialize strictly to neutral / closed home position
  servo360Chute.writeMicroseconds(SERVO_360_STOP_US);
  servo180Trapdoor.write(TRAPDOOR_CLOSED_DEG);

  // Connect to STA Wi-Fi
  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(200);
  WiFi.mode(WIFI_STA);

  Serial.printf("[WIFI] Attempting connection to SSID: '%s'...\n", STA_SSID);
  WiFi.begin(STA_SSID, STA_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    activeIP = WiFi.localIP().toString();
    Serial.println("\n[WIFI SUCCESS] Connected to network!");
    Serial.printf("[WIFI] DevKit IP: %s\n", activeIP.c_str());
  } else {
    Serial.printf("\n[WIFI WARNING] Could not connect to '%s'. Starting Access Point...\n", STA_SSID);
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASSWORD);
    activeIP = WiFi.softAPIP().toString();
    Serial.printf("[AP ACTIVE] Hotspot: '%s' | Password: '%s'\n", AP_SSID, AP_PASSWORD);
    Serial.printf("[AP ACTIVE] DevKit IP: http://%s\n", activeIP.c_str());
  }

  Serial.println("--------------------------------------------------------");
  Serial.printf("[URL] Control Panel: http://%s/\n", activeIP.c_str());
  Serial.printf("[URL] Status Check:  http://%s/status\n", activeIP.c_str());
  Serial.printf("[URL] Test Plastic:  http://%s/sort?type=PLASTIC\n", activeIP.c_str());
  Serial.println("--------------------------------------------------------\n");

  // Routes
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/sort", handleSort);
  server.on("/calibrate", handleCalibrate);
  server.begin();
  Serial.println("[SERVER] Sorter Server active on port 80.");
}

// ---------------- Loop ----------------
void loop() {
  server.handleClient();
  
  // Background reconnect only if configured in STA mode
  if (WiFi.getMode() == WIFI_STA) {
    static unsigned long lastCheck = 0;
    if (millis() - lastCheck > 15000) {
      lastCheck = millis();
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Reconnecting...");
        WiFi.reconnect();
      }
    }
  }
}
