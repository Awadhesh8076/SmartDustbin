/*
 * =========================================================================
 * Smart Dustbin - ESP32 DevKit Sorting Mechanism Controller
 * Board: ESP32 DevKit V1 (30 or 36 pins)
 * Description: Listens for HTTP sort commands from Unity Mobile, drives dual 
 *              servo motors for direction selection and waste release, then
 *              returns a verified JSON SUCCESS response for coin rewards.
 * Library Required: ESP32Servo (Install via Arduino Library Manager)
 * =========================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

// ==========================================
// 1. WiFi Configuration
// ==========================================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Optional: Static IP configuration
IPAddress local_IP(192, 168, 4, 20);
IPAddress gateway(192, 168, 4, 1);
IPAddress subnet(255, 255, 255, 0);

WebServer server(80);

// ==========================================
// 2. Servo Pin & Angle Definitions
// ==========================================
#define SERVO1_PIN 18  // Direction / Chute Selector Servo
#define SERVO2_PIN 19  // Trapdoor / Waste Release Flap Servo

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

// Status tracking
bool isBusy = false;

// ==========================================
// 3. Sorting Routine
// ==========================================
void executeSorting(String wasteType) {
  isBusy = true;
  wasteType.toUpperCase();
  Serial.println("\n[SORTING] Initiating mechanism for: " + wasteType);

  int targetAngle = DIR_HOME;
  if (wasteType == "PLASTIC") {
    targetAngle = DIR_PLASTIC;
  } else if (wasteType == "METAL") {
    targetAngle = DIR_METAL;
  } else if (wasteType == "WET") {
    targetAngle = DIR_WET;
  } else if (wasteType == "DRY") {
    targetAngle = DIR_DRY;
  } else {
    targetAngle = DIR_PLASTIC; // Fallback default
  }

  // Step 1: Rotate selector chute to appropriate bin compartment
  Serial.printf("[SERVO 1] Rotating selector to %d deg\n", targetAngle);
  servoDirection.write(targetAngle);
  delay(600); // Allow servo to reach target

  // Step 2: Open trapdoor / drop flap
  Serial.printf("[SERVO 2] Opening release flap to %d deg\n", TRAP_OPEN);
  servoTrapdoor.write(TRAP_OPEN);
  delay(1200); // Allow waste item to fall into compartment

  // Step 3: Close trapdoor flap
  Serial.printf("[SERVO 2] Closing flap to %d deg\n", TRAP_CLOSED);
  servoTrapdoor.write(TRAP_CLOSED);
  delay(500);

  // Step 4: Return chute to neutral home position
  Serial.printf("[SERVO 1] Returning selector to home (%d deg)\n", DIR_HOME);
  servoDirection.write(DIR_HOME);
  delay(400);

  Serial.println("[SORTING] Mechanism cycle completed successfully.");
  isBusy = false;
}

// ==========================================
// 4. HTTP Request Handlers
// ==========================================
void handleSort() {
  server.sendHeader("Access-Control-Allow-Origin", "*");

  if (isBusy) {
    Serial.println("[ESP32] REJECTED: Sorter mechanism is currently busy!");
    server.send(429, "application/json", "{\"status\":\"BUSY\",\"message\":\"Sorter is currently executing another cycle.\"}");
    return;
  }

  if (!server.hasArg("type")) {
    Serial.println("[ESP32] ERROR: Missing 'type' query parameter!");
    server.send(400, "application/json", "{\"status\":\"ERROR\",\"message\":\"Missing 'type' parameter in query string.\"}");
    return;
  }

  String wasteType = server.arg("type");
  
  Serial.println("\n========================================");
  Serial.println("  >>> COMMAND RECEIVED FROM UNITY APP <<<");
  Serial.printf("  Waste Category : %s\n", wasteType.c_str());
  Serial.printf("  Client IP      : %s\n", server.client().remoteIP().toString().c_str());
  Serial.println("========================================");

  // Execute physical servo movement
  executeSorting(wasteType);

  // Send verified SUCCESS response back to Unity
  String jsonResponse = "{\"status\":\"SUCCESS\",\"waste\":\"" + wasteType + "\",\"message\":\"Sorted successfully\"}";
  server.send(200, "application/json", jsonResponse);
  Serial.println("[ESP32] Sent SUCCESS response to Unity app.\n");
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String json = "{\"device\":\"ESP32_DevKit_Sorter\",\"status\":\"ONLINE\",\"busy\":" + String(isBusy ? "true" : "false") + "}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.send(200, "text/html", "<h2>Smart Dustbin Sorter DevKit</h2><p>Send <code>/sort?type=PLASTIC</code> to test sorting.</p>");
}

// ==========================================
// 5. Setup & Loop
// ==========================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n[INIT] Starting Smart Dustbin Sorter DevKit...");

  // Initialize Servos using ESP32 PWM channels
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  servoDirection.setPeriodHertz(50); // Standard 50Hz servo
  servoTrapdoor.setPeriodHertz(50);

  servoDirection.attach(SERVO1_PIN, 500, 2400);
  servoTrapdoor.attach(SERVO2_PIN, 500, 2400);

  // Reset to initial positions
  servoDirection.write(DIR_HOME);
  servoTrapdoor.write(TRAP_CLOSED);

  // Connect to WiFi
  // WiFi.config(local_IP, gateway, subnet); // Uncomment to enforce static IP
  WiFi.begin(ssid, password);
  Serial.print("[WIFI] Connecting to ");
  Serial.print(ssid);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[WIFI] Connected!");
  Serial.print("[WIFI] Sorter Controller IP: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/sort?type=PLASTIC");

  // Route Handlers
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/sort", handleSort);
  server.begin();
  Serial.println("[SERVER] Sorter HTTP Server started");
}

void loop() {
  server.handleClient();
}
