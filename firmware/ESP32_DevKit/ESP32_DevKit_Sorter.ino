/*
 * =========================================================================
 * Smart Dustbin - ESP32 DevKit Dual-Servo Sorter (Wi-Fi Station Mode)
 * Board: ESP32 DevKit V1 (30 or 36 pins)
 * Servos:
 *   1. Continuous-Rotation 360-Degree Servo (Chute / Turntable, GPIO 18)
 *      - Calibrated speed pulses & stop pulses for timed indexing.
 *   2. Positional 180-Degree Servo (Trapdoor / Flap Release, GPIO 19)
 *      - Calibrated 0° (closed) and 90° (open) positions.
 * Features:
 *   - Wi-Fi Station Mode via DHCP (prints IP to Serial Monitor).
 *   - Strict category validation (rejects UNKNOWN / invalid categories).
 *   - Request deduplication (protects against duplicate actuation).
 *   - Busy guard (HTTP 429) & timeout resilience.
 * Library Required: ESP32Servo (Install via Arduino Library Manager)
 * =========================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

// ==========================================
// 1. WiFi Configuration (Station Mode / DHCP)
// Replace with your local Wi-Fi credentials
// ==========================================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

WebServer server(80);

// ==========================================
// 2. Servo Pin & Pulse Configurations
// ==========================================
#define SERVO_360_PIN 18  // Continuous-Rotation 360° Servo (Chute selector)
#define SERVO_180_PIN 19  // Positional 180° Servo (Trapdoor flap release)

Servo servo360Chute;
Servo servo180Trapdoor;

// Continuous-Rotation 360° Servo Calibration:
// Angle mapping for 360 continuous servos:
//   90° = Neutral / Full Stop (Pulse ~1500us)
//  <90° = Clockwise rotation (e.g. 70° for calibrated forward speed)
//  >90° = Counter-clockwise rotation (e.g. 110° for calibrated reverse speed)
const int SERVO_360_STOP = 90;
const int SERVO_360_CW_SPEED = 70;    // Forward rotation speed
const int SERVO_360_CCW_SPEED = 110;  // Return rotation speed

// Calibrated rotation durations (in milliseconds) from Home (0) to each bin
const int DURATION_PLASTIC_MS = 400;  // Compartment 1
const int DURATION_METAL_MS   = 800;  // Compartment 2
const int DURATION_WET_MS     = 1200; // Compartment 3
const int DURATION_DRY_MS     = 1600; // Compartment 4

// Positional 180° Flap Servo Angles:
const int TRAP_CLOSED = 0;   // Flap closed (holds waste during camera scan)
const int TRAP_OPEN   = 90;  // Flap opened (releases waste into selected chute)
const int FLAP_HOLD_OPEN_MS = 1200; // Time held open for item to drop

// System State
bool isBusy = false;
String lastExecutedCommandId = "";
unsigned long lastExecutionTimestamp = 0;

// ==========================================
// 3. Physical Sorting Routine
// ==========================================
bool executeSortingCycle(String category, String commandId) {
  isBusy = true;
  category.toUpperCase();
  Serial.printf("\n[SORTING] === Starting Sorting Routine for: %s ===\n", category.c_str());
  if (commandId.length() > 0) {
    Serial.printf("[SORTING] Command UUID: %s\n", commandId.c_str());
  }

  // 1. Determine calibrated rotation duration for the continuous 360° servo
  int runDuration = 0;
  if (category == "PLASTIC") {
    runDuration = DURATION_PLASTIC_MS;
  } else if (category == "METAL") {
    runDuration = DURATION_METAL_MS;
  } else if (category == "WET") {
    runDuration = DURATION_WET_MS;
  } else if (category == "DRY") {
    runDuration = DURATION_DRY_MS;
  } else {
    Serial.println("[ERROR] Unknown category passed to executeSortingCycle! Aborting.");
    isBusy = false;
    return false;
  }

  // Step A: Rotate 360° continuous servo clockwise to index position
  Serial.printf("[SERVO 360] Indexing chute to %s compartment (Rotating CW for %d ms)\n", category.c_str(), runDuration);
  servo360Chute.write(SERVO_360_CW_SPEED);
  delay(runDuration);

  // Step B: Send calibrated stop pulse to hold position
  servo360Chute.write(SERVO_360_STOP);
  delay(250); // Stabilization settle

  // Step C: Open 180° trapdoor flap to drop waste
  Serial.printf("[SERVO 180] Opening release flap to %d deg for %d ms\n", TRAP_OPEN, FLAP_HOLD_OPEN_MS);
  servo180Trapdoor.write(TRAP_OPEN);
  delay(FLAP_HOLD_OPEN_MS);

  // Step D: Close 180° trapdoor flap
  Serial.printf("[SERVO 180] Closing release flap back to %d deg\n", TRAP_CLOSED);
  servo180Trapdoor.write(TRAP_CLOSED);
  delay(500); // Allow flap to seal

  // Step E: Return 360° continuous servo counter-clockwise back to Home index
  Serial.printf("[SERVO 360] Returning chute to Home (Rotating CCW for %d ms)\n", runDuration);
  servo360Chute.write(SERVO_360_CCW_SPEED);
  delay(runDuration);

  // Step F: Complete cycle with stop pulse
  servo360Chute.write(SERVO_360_STOP);
  delay(200);

  // Update deduplication cache
  if (commandId.length() > 0) {
    lastExecutedCommandId = commandId;
    lastExecutionTimestamp = millis();
  }

  Serial.println("[SORTING] Physical cycle completed successfully.\n");
  isBusy = false;
  return true;
}

// ==========================================
// 4. HTTP Request Handlers
// ==========================================
void handleSort() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");

  // Check 1: Sorter busy check (anti-collision)
  if (isBusy) {
    Serial.println("[REJECTED] Sorter is currently executing another physical cycle.");
    server.send(429, "application/json", "{\"status\":\"BUSY\",\"message\":\"Sorter mechanism is currently busy.\" }");
    return;
  }

  // Check 2: Missing 'type' parameter
  if (!server.hasArg("type")) {
    Serial.println("[ERROR] Missing required 'type' query parameter.");
    server.send(400, "application/json", "{\"status\":\"ERROR\",\"message\":\"Missing 'type' parameter. Allowed: PLASTIC, METAL, WET, DRY.\"}");
    return;
  }

  String wasteType = server.arg("type");
  wasteType.toUpperCase();

  // Check 3: Strict Zero-Guessing Policy — Reject UNKNOWN and invalid categories!
  if (wasteType == "UNKNOWN" || (wasteType != "PLASTIC" && wasteType != "METAL" && wasteType != "WET" && wasteType != "DRY")) {
    Serial.printf("[REJECTED] Category '%s' is UNKNOWN or invalid. Zero-guessing policy prohibits actuation.\n", wasteType.c_str());
    server.send(400, "application/json", "{\"status\":\"REJECTED\",\"waste\":\"" + wasteType + "\",\"message\":\"Actuation rejected: Zero-guessing policy forbids sorting UNKNOWN or unrecognized waste.\"}");
    return;
  }

  // Check 4: Request Deduplication
  String commandId = server.hasArg("command_id") ? server.arg("command_id") : "";
  if (commandId.length() > 0 && commandId == lastExecutedCommandId && (millis() - lastExecutionTimestamp < 15000)) {
    Serial.printf("[DEDUPLICATION] Duplicate command_id '%s' detected within 15s. Returning cached SUCCESS without re-actuation.\n", commandId.c_str());
    String cachedResponse = "{\"status\":\"SUCCESS\",\"waste\":\"" + wasteType + "\",\"command_id\":\"" + commandId + "\",\"message\":\"Duplicate request acknowledged; previously actuated successfully.\"}";
    server.send(200, "application/json", cachedResponse);
    return;
  }

  Serial.println("==================================================");
  Serial.printf("  [COMMAND RECEIVED] Category: %s\n", wasteType.c_str());
  Serial.printf("  Client IP: %s\n", server.client().remoteIP().toString().c_str());
  if (commandId.length() > 0) {
    Serial.printf("  Command ID: %s\n", commandId.c_str());
  }
  Serial.println("==================================================");

  // Execute physical movement
  bool success = executeSortingCycle(wasteType, commandId);

  if (success) {
    String jsonResponse = "{\"status\":\"SUCCESS\",\"waste\":\"" + wasteType + "\",\"command_id\":\"" + commandId + "\",\"message\":\"Physical sorting completed successfully.\"}";
    server.send(200, "application/json", jsonResponse);
  } else {
    server.send(500, "application/json", "{\"status\":\"FAILED\",\"message\":\"Physical sorting cycle failed.\"}");
  }
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String json = "{\"device\":\"ESP32_DevKit_Sorter\",\"status\":\"ONLINE\",\"busy\":" + String(isBusy ? "true" : "false") + 
                ",\"ip\":\"" + WiFi.localIP().toString() + "\",\"uptime_ms\":" + String(millis()) + 
                ",\"servos\":{\"continuous_chute_gpio\":18,\"positional_flap_gpio\":19}}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String html = "<!DOCTYPE html><html><head><title>SmartDustbin DevKit Sorter</title>"
                "<style>body{font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;}"
                "a{color:#38bdf8;text-decoration:none;}a:hover{text-decoration:underline;}"
                ".card{background:#1e293b;border-radius:12px;padding:20px;max-width:550px;border:1px solid #334155;}"
                ".badge{background:#0284c7;color:#fff;padding:4px 10px;border-radius:999px;font-size:12px;}"
                "code{background:#0f172a;padding:2px 6px;border-radius:4px;color:#a5f3fc;}"
                "</style></head><body>"
                "<div class='card'>"
                "<h2>SmartDustbin DevKit Sorter <span class='badge'>ONLINE</span></h2>"
                "<p><strong>IP Address:</strong> " + WiFi.localIP().toString() + "</p>"
                "<p><strong>Servo 1 (Chute):</strong> Continuous 360° on GPIO 18</p>"
                "<p><strong>Servo 2 (Flap):</strong> Positional 180° on GPIO 19</p>"
                "<hr style='border-color:#334155;margin:15px 0;'>"
                "<h3>Endpoints</h3>"
                "<ul>"
                "<li><a href='/status'>/status</a> — Sorter health & busy state JSON</li>"
                "<li><code>/sort?type=PLASTIC</code> — Actuate plastic compartment</li>"
                "<li><code>/sort?type=METAL</code> — Actuate metal compartment</li>"
                "<li><code>/sort?type=WET</code> — Actuate wet compartment</li>"
                "<li><code>/sort?type=DRY</code> — Actuate dry compartment</li>"
                "</ul>"
                "</div></body></html>";
  server.send(200, "text/html", html);
}

// ==========================================
// 5. Setup & Initialization
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==================================================");
  Serial.println(" Smart Dustbin - ESP32 DevKit Dual-Servo Sorter   ");
  Serial.println("==================================================");

  // Allocate ESP32 PWM Timers for Servos
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  servo360Chute.setPeriodHertz(50);
  servo180Trapdoor.setPeriodHertz(50);

  // Attach servos to respective pins
  servo360Chute.attach(SERVO_360_PIN, 500, 2400);
  servo180Trapdoor.attach(SERVO_180_PIN, 500, 2400);

  // Calibrated initial positions: Stop pulse for 360°, Closed for 180°
  servo360Chute.write(SERVO_360_STOP);
  servo180Trapdoor.write(TRAP_CLOSED);

  // Connect to Wi-Fi in Station Mode using DHCP
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[WIFI] Connecting to Wi-Fi SSID: ");
  Serial.println(ssid);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully via DHCP!");
    Serial.printf("[WIFI] Assigned IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] Subnet Mask: %s\n", WiFi.subnetMask().toString().c_str());
    Serial.printf("[WIFI] Gateway IP: %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("[WIFI] RSSI Signal: %d dBm\n", WiFi.RSSI());
    Serial.println("--------------------------------------------------");
    Serial.printf("[INFO] Web UI root URL:    http://%s/\n", WiFi.localIP().toString().c_str());
    Serial.printf("[INFO] Health status JSON: http://%s/status\n", WiFi.localIP().toString().c_str());
    Serial.printf("[INFO] Test sort URL:      http://%s/sort?type=PLASTIC\n", WiFi.localIP().toString().c_str());
    Serial.println("--------------------------------------------------");
  } else {
    Serial.println("\n[ERROR] Wi-Fi connection timed out. Please check SSID/Password and router availability.");
  }

  // Register HTTP Route Handlers
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/sort", handleSort);
  server.begin();
  Serial.println("[SERVER] ESP32 DevKit Sorter HTTP Server active on port 80.");
}

void loop() {
  server.handleClient();
}
