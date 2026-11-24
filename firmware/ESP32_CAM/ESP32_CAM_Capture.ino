/*
 * =========================================================================
 * Smart Dustbin - ESP32-CAM Capture Server (Wi-Fi Station Mode)
 * Board: AI-Thinker ESP32-CAM (OV2640)
 * Description: Connects to local Wi-Fi via DHCP, prints assigned IP to Serial
 *              Monitor, and provides HTTP GET /capture and /status for FastAPI.
 * =========================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

// ==========================================
// 1. WiFi Configuration (Station Mode / DHCP)
// Replace with your local Wi-Fi credentials
// ==========================================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

WebServer server(80);

// ==========================================
// 2. AI-Thinker Camera Pin Map Definition
// ==========================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define FLASH_LED_PIN      4

// ==========================================
// 3. HTTP Request Handlers
// ==========================================
void handleCapture() {
  // Capture frame from OV2640 sensor
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[ERROR] Camera capture failed: frame buffer is null");
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(500, "application/json", "{\"status\":\"ERROR\",\"message\":\"Camera capture failed: frame buffer null\"}");
    return;
  }

  // Set permissive CORS headers for local LAN access
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.sendHeader("Pragma", "no-cache");
  server.sendHeader("Expires", "0");

  server.send_P(200, "image/jpeg", (const char *)fb->buf, fb->len);
  
  esp_camera_fb_return(fb);
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String json = "{\"device\":\"ESP32_CAM\",\"status\":\"ONLINE\",\"ip\":\"" + WiFi.localIP().toString() + "\",\"psram\":" + String(psramFound() ? "true" : "false") + "}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String html = "<!DOCTYPE html><html><head><title>SmartDustbin ESP32-CAM</title>"
                "<style>body{font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;}"
                "a{color:#38bdf8;text-decoration:none;}a:hover{text-decoration:underline;}"
                ".card{background:#1e293b;border-radius:12px;padding:20px;max-width:500px;border:1px solid #334155;}"
                ".badge{background:#059669;color:#fff;padding:4px 10px;border-radius:999px;font-size:12px;}"
                "</style></head><body>"
                "<div class='card'>"
                "<h2>SmartDustbin ESP32-CAM <span class='badge'>ONLINE</span></h2>"
                "<p><strong>IP Address:</strong> " + WiFi.localIP().toString() + "</p>"
                "<p><strong>PSRAM Found:</strong> " + String(psramFound() ? "Yes" : "No") + "</p>"
                "<hr style='border-color:#334155;margin:15px 0;'>"
                "<h3>Endpoints</h3>"
                "<ul>"
                "<li><a href='/status'>/status</a> — Device health JSON</li>"
                "<li><a href='/capture'>/capture</a> — Live JPEG snapshot</li>"
                "</ul>"
                "</div></body></html>";
  server.send(200, "text/html", html);
}

// ==========================================
// 4. Setup & Initialization
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==================================================");
  Serial.println("  Smart Dustbin - ESP32-CAM (Station / DHCP Mode) ");
  Serial.println("==================================================");

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW); // Flash LED off by default

  // Camera Configuration
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Frame size & quality configuration
  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA; // 640x480
    config.jpeg_quality = 10;          // High quality (0-63 scale)
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA; // 320x240
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Camera Init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] Camera initialization failed with error code: 0x%x\n", err);
    return;
  }

  sensor_t * s = esp_camera_sensor_get();
  s->set_vflip(s, 0);   // Set to 1 if image is inverted
  s->set_hmirror(s, 0); // Set to 1 if image is mirrored

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
    Serial.printf("[INFO] Snapshot capture:   http://%s/capture\n", WiFi.localIP().toString().c_str());
    Serial.printf("[INFO] Health status JSON: http://%s/status\n", WiFi.localIP().toString().c_str());
    Serial.println("--------------------------------------------------");
  } else {
    Serial.println("\n[ERROR] Wi-Fi connection timed out. Please check SSID/Password and router availability.");
  }

  // Register HTTP Route Handlers
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/capture", handleCapture);
  server.begin();
  Serial.println("[SERVER] ESP32-CAM HTTP Server active on port 80.");
}

void loop() {
  server.handleClient();
}
