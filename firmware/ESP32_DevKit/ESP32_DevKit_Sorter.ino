/*
 * =========================================================================
 * SmartDustbin ESP32 DevKit Dual-Servo Sorter (FINAL FIXED)
 * Board: DOIT ESP32 DEVKIT V1 (Compatible with ESP32 core v2.x & v3.x)
 * Library: ESP32Servo
 * Connects to: SmartDustbin Access Point (192.168.4.1)
 * Fixed Static IP: 192.168.4.20
 * =========================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

const char* ssid = "SmartDustbin";
const char* password = "dustbin1234";

IPAddress local_IP(192, 168, 4, 20);
IPAddress gateway(192, 168, 4, 1);
IPAddress subnet(255, 255, 255, 0);

WebServer server(80);

// Servo Pins
#define SERVO1_PIN 18  // Chute Direction Selector Servo
#define SERVO2_PIN 19  // Trapdoor Release Flap Servo

Servo servoDirection;
Servo servoTrapdoor;

// Angle Configurations
const int DIR_HOME = 0;
const int DIR_PLASTIC = 45;
const int DIR_METAL = 90;
const int DIR_WET = 135;
const int DIR_DRY = 180;

const int TRAP_CLOSED = 0;
const int TRAP_OPEN = 90;

bool isBusy = false;

void executeSorting(String wasteType) {
  isBusy = true;
  wasteType.toUpperCase();
  Serial.println("\n[SORTING] Starting cycle for: " + wasteType);

  int targetAngle = DIR_HOME;
  if (wasteType == "PLASTIC") targetAngle = DIR_PLASTIC;
  else if (wasteType == "METAL") targetAngle = DIR_METAL;
  else if (wasteType == "WET") targetAngle = DIR_WET;
  else if (wasteType == "DRY") targetAngle = DIR_DRY;
  else targetAngle = DIR_PLASTIC;

  // Step 1: Rotate selector chute (600ms)
  Serial.printf("[SERVO 1] Chute angle -> %d deg\n", targetAngle);
  servoDirection.write(targetAngle);
  delay(600);

  // Step 2: Open trapdoor release flap (1200ms)
  Serial.printf("[SERVO 2] Release flap OPEN -> %d deg\n", TRAP_OPEN);
  servoTrapdoor.write(TRAP_OPEN);
  delay(1200);

  // Step 3: Close trapdoor flap (500ms)
  Serial.printf("[SERVO 2] Release flap CLOSED -> %d deg\n", TRAP_CLOSED);
  servoTrapdoor.write(TRAP_CLOSED);
  delay(500);

  // Step 4: Reset chute to Home (400ms)
  Serial.printf("[SERVO 1] Chute return home -> %d deg\n", DIR_HOME);
  servoDirection.write(DIR_HOME);
  delay(400);

  Serial.println("[SORTING] Routine finished successfully.");
  isBusy = false;
}

void handleSort() {
  server.sendHeader("Access-Control-Allow-Origin", "*");

  if (isBusy) {
    server.send(429, "application/json", "{\"status\":\"BUSY\",\"message\":\"Sorter is busy.\"}");
    return;
  }

  if (!server.hasArg("type")) {
    server.send(400, "application/json", "{\"status\":\"ERROR\",\"message\":\"Missing 'type' query parameter.\"}");
    return;
  }

  String wasteType = server.arg("type");
  executeSorting(wasteType);

  String jsonResponse = "{\"status\":\"SUCCESS\",\"waste\":\"" + wasteType + "\",\"message\":\"Sorted successfully\"}";
  server.send(200, "application/json", jsonResponse);
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String json = "{\"device\":\"ESP32_DevKit_Sorter\",\"status\":\"ONLINE\",\"busy\":" + String(isBusy ? "true" : "false") + "}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", "<h2>Smart Dustbin DevKit Sorter Online</h2><p>Endpoint: <code>/sort?type=PLASTIC</code></p>");
}

void setup() {
  // Universal Brownout handling (compatible with ESP32 core 2.x and 3.x)
  #ifdef RTC_CNTL_BROWN_OUT_REG
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  #elif defined(RTC_CNTL_BROWNOUT_REG)
    WRITE_PERI_REG(RTC_CNTL_BROWNOUT_REG, 0);
  #endif

  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[INIT] Starting Smart Dustbin DevKit Sorter...");

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  servoDirection.setPeriodHertz(50);
  servoTrapdoor.setPeriodHertz(50);
  servoDirection.attach(SERVO1_PIN, 500, 2400);
  servoTrapdoor.attach(SERVO2_PIN, 500, 2400);

  servoDirection.write(DIR_HOME);
  servoTrapdoor.write(TRAP_CLOSED);

  // Connect to SmartDustbin Wi-Fi Access Point
  WiFi.mode(WIFI_STA);
  WiFi.config(local_IP, gateway, subnet);
  WiFi.begin(ssid, password);

  Serial.println("[WIFI] Connecting to SmartDustbin Hotspot...");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected to SmartDustbin!");
    Serial.print("[WIFI] Fixed Sorter IP: http://");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WIFI] Hotspot not found yet. Retrying in background...");
  }

  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/sort", handleSort);
  server.begin();
  Serial.println("[SERVER] Sorter HTTP Server listening on port 80");
}

void loop() {
  server.handleClient();

  if (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    WiFi.reconnect();
  }
}
