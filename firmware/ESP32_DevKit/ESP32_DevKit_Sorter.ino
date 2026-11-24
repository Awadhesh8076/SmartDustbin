/*
 * =========================================================================
 * Smart Dustbin - ESP32 DevKit Dual-Servo Sorter (FINAL BULLETPROOF WI-FI)
 * Board: ESP32 DevKit V1 (30 or 36 pins)
 * 
 * Hardware Pins:
 *   - Servo 1: Continuous 360° Servo (Chute / Turntable) on GPIO 18
 *   - Servo 2: Positional 180° Servo (Trapdoor Flap) on GPIO 19
 * 
 * Wi-Fi Credentials:
 *   - SSID: Smartdustbin
 *   - Password: Smartdustbin123
 * =========================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// Wi-Fi Credentials (Change if your Hotspot uses different SSID/Password)
const char* ssid = "Smartdustbin";
const char* password = "Smartdustbin123";

WebServer server(80);

// Servo Pins
#define SERVO_360_PIN 18  // Continuous-Rotation 360° Servo (Chute)
#define SERVO_180_PIN 19  // Positional 180° Servo (Flap)

Servo servo360Chute;
Servo servo180Trapdoor;

// 360° Continuous Servo Speeds & Neutral Stop
// 90 is neutral stop. <90 is CW forward, >90 is CCW return.
const int SERVO_360_STOP = 90;
const int SERVO_360_CW_SPEED = 70;    // Forward rotation speed
const int SERVO_360_CCW_SPEED = 110;  // Return rotation speed

// Rotation Durations (ms) to reach each compartment from Home
const int DURATION_PLASTIC_MS = 400;  // Bin 1 (Plastic)
const int DURATION_METAL_MS   = 800;  // Bin 2 (Metal)
const int DURATION_WET_MS     = 1200; // Bin 3 (Wet)
const int DURATION_DRY_MS     = 1600; // Bin 4 (Dry)

// 180° Trapdoor Flap Servo Angles
const int TRAP_CLOSED = 0;           // Flap closed
const int TRAP_OPEN   = 90;          // Flap open
const int FLAP_HOLD_OPEN_MS = 1200;  // Open duration to release waste

bool isBusy = false;

bool executeSortingCycle(String category) {
  isBusy = true;
  category.toUpperCase();
  Serial.printf("\n[SORTING] Actuating for: %s\n", category.c_str());

  int runDuration = 0;
  if (category == "PLASTIC") runDuration = DURATION_PLASTIC_MS;
  else if (category == "METAL") runDuration = DURATION_METAL_MS;
  else if (category == "WET") runDuration = DURATION_WET_MS;
  else if (category == "DRY") runDuration = DURATION_DRY_MS;
  else {
    Serial.println("[ERROR] Invalid category received!");
    isBusy = false;
    return false;
  }

  // Step 1: Rotate 360° continuous chute forward to selected bin compartment
  Serial.printf("[SERVO 360] Rotating chute to %s for %d ms\n", category.c_str(), runDuration);
  servo360Chute.write(SERVO_360_CW_SPEED);
  delay(runDuration);

  // Step 2: Stop pulse to hold chute over bin
  servo360Chute.write(SERVO_360_STOP);
  delay(250);

  // Step 3: Open 180° trapdoor flap to drop item
  Serial.printf("[SERVO 180] Opening flap (%d deg) for %d ms\n", TRAP_OPEN, FLAP_HOLD_OPEN_MS);
  servo180Trapdoor.write(TRAP_OPEN);
  delay(FLAP_HOLD_OPEN_MS);

  // Step 4: Close trapdoor flap
  Serial.printf("[SERVO 180] Closing flap (%d deg)\n", TRAP_CLOSED);
  servo180Trapdoor.write(TRAP_CLOSED);
  delay(500);

  // Step 5: Rotate 360° continuous chute back to Home
  Serial.printf("[SERVO 360] Returning chute to Home (CCW for %d ms)\n", runDuration);
  servo360Chute.write(SERVO_360_CCW_SPEED);
  delay(runDuration);

  // Step 6: Complete stop at Home
  servo360Chute.write(SERVO_360_STOP);
  delay(200);

  Serial.println("[SORTING] Physical actuation completed.\n");
  isBusy = false;
  return true;
}

void handleSort() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");

  if (isBusy) {
    server.send(429, "application/json", "{\"status\":\"BUSY\",\"message\":\"Sorter is busy.\"}");
    return;
  }

  if (!server.hasArg("type")) {
    server.send(400, "application/json", "{\"status\":\"ERROR\",\"message\":\"Missing 'type' parameter.\"}");
    return;
  }

  String wasteType = server.arg("type");
  wasteType.toUpperCase();

  if (wasteType != "PLASTIC" && wasteType != "METAL" && wasteType != "WET" && wasteType != "DRY") {
    server.send(400, "application/json", "{\"status\":\"REJECTED\",\"message\":\"Invalid category.\"}");
    return;
  }

  bool ok = executeSortingCycle(wasteType);

  if (ok) {
    String json = "{\"status\":\"SUCCESS\",\"waste\":\"" + wasteType + "\",\"message\":\"Sorted successfully\"}";
    server.send(200, "application/json", json);
  } else {
    server.send(500, "application/json", "{\"status\":\"FAILED\",\"message\":\"Actuation failed\"}");
  }
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String json = "{\"device\":\"ESP32_DevKit_Sorter\",\"status\":\"ONLINE\",\"busy\":" + String(isBusy ? "true" : "false") + 
                ",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", 
    "<h2>Smart Dustbin DevKit Sorter Online</h2>"
    "<p><a href='/status'>Check Status (/status)</a></p>"
    "<p><a href='/sort?type=PLASTIC'>Test Plastic Sort</a></p>"
    "<p><a href='/sort?type=METAL'>Test Metal Sort</a></p>"
    "<p><a href='/sort?type=WET'>Test Wet Sort</a></p>"
    "<p><a href='/sort?type=DRY'>Test Dry Sort</a></p>"
  );
}

void setup() {
  #ifdef RTC_CNTL_BROWN_OUT_REG
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  #elif defined(RTC_CNTL_BROWNOUT_REG)
    WRITE_PERI_REG(RTC_CNTL_BROWNOUT_REG, 0);
  #endif

  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==================================================");
  Serial.println("  Smart Dustbin - ESP32 DevKit Dual-Servo Sorter  ");
  Serial.println("==================================================");

  // Initialize Hardware Timers & Servos
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  servo360Chute.setPeriodHertz(50);
  servo180Trapdoor.setPeriodHertz(50);

  servo360Chute.attach(SERVO_360_PIN, 500, 2400);
  servo180Trapdoor.attach(SERVO_180_PIN, 500, 2400);

  // Neutral defaults
  servo360Chute.write(SERVO_360_STOP);
  servo180Trapdoor.write(TRAP_CLOSED);

  // Wi-Fi Connection Routine with Auto-Reconnect
  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(200);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  Serial.printf("[WIFI] Attempting connection to SSID: '%s'\n", ssid);
  WiFi.begin(ssid, password);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 30) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n\n[WIFI SUCCESS] Connected to network!");
    Serial.printf("[WIFI] Assigned DevKit IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] Subnet Mask:        %s\n", WiFi.subnetMask().toString().c_str());
    Serial.printf("[WIFI] Gateway IP:         %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("[WIFI] Signal Strength:    %d dBm\n", WiFi.RSSI());
    Serial.println("--------------------------------------------------");
    Serial.printf("[TEST] Sorter Status: http://%s/status\n", WiFi.localIP().toString().c_str());
    Serial.printf("[TEST] Plastic Sort:  http://%s/sort?type=PLASTIC\n", WiFi.localIP().toString().c_str());
    Serial.println("--------------------------------------------------\n");
  } else {
    Serial.printf("\n\n[WIFI FAILED] Could not connect to '%s' (Status Code: %d)\n", ssid, WiFi.status());
    Serial.println("Troubleshooting Tips:");
    Serial.println("  1. Verify SSID and Password match your Hotspot EXACTLY (case-sensitive).");
    Serial.println("  2. Ensure Hotspot is on 2.4 GHz band (Enable 'Maximize Compatibility' on iPhone).");
    Serial.println("  3. Make sure the Hotspot is turned ON and nearby.\n");
  }

  // Register HTTP Routes
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/sort", handleSort);
  server.begin();
  Serial.println("[SERVER] Sorter HTTP Server listening on port 80.");
}

void loop() {
  server.handleClient();
  
  // Background Wi-Fi Reconnect Guard
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 10000) {
    lastCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WIFI] Connection lost. Reconnecting...");
      WiFi.reconnect();
    }
  }
}
