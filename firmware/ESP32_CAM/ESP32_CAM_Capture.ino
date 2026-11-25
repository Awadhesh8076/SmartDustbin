/*
 * =========================================================================
 * Smart Dustbin - ESP32-CAM Capture Server (FINAL BULLETPROOF & AUTO-AP)
 * Board: AI Thinker ESP32-CAM
 * Description: High-reliability JPEG capture server with Auto-AP failsafe,
 *              brownout prevention, and zero-hang network startup.
 * =========================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ==========================================
// 1. Wi-Fi Configuration
// ==========================================
const char* STA_SSID     = "Smartdustbin";
const char* STA_PASSWORD = "Smartdustbin123";

// Failsafe Hotspot (Starts if STA connection fails within 10s)
const char* AP_SSID      = "SmartDustbin_CAM";
const char* AP_PASSWORD  = "12345678";

WebServer server(80);

// AI-Thinker Camera Pin Map
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

String activeIP = "";

// ==========================================
// 2. HTTP Endpoints
// ==========================================
void handleCapture() {
  // Flash LED briefly to illuminate object if needed (comment out if not desired)
  // digitalWrite(FLASH_LED_PIN, HIGH);
  // delay(50);

  camera_fb_t * fb = esp_camera_fb_get();
  // digitalWrite(FLASH_LED_PIN, LOW);

  if (!fb) {
    Serial.println("[ERROR] esp_camera_fb_get() failed");
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(500, "text/plain", "Camera Frame Buffer Capture Failed");
    return;
  }

  // Cross-origin headers so Web/Vite/Backend can read directly
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  server.sendHeader("Content-Disposition", "inline; filename=capture.jpg");
  server.send_P(200, "image/jpeg", (const char *)fb->buf, fb->len);
  
  esp_camera_fb_return(fb);
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String json = "{\"device\":\"ESP32_CAM\",\"status\":\"ONLINE\",\"ip\":\"" + activeIP + "\"}";
  server.send(200, "application/json", json);
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<title>Smart Dustbin ESP32-CAM</title>"
    "<style>body{font-family:system-ui;padding:20px;background:#0f172a;color:#f8fafc;text-align:center;}"
    "a{display:inline-block;margin:10px;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;}"
    ".btn-green{background:#16a34a;}.card{background:#1e293b;padding:20px;border-radius:8px;max-width:500px;margin:auto;}"
    "</style></head><body>"
    "<div class='card'>"
    "<h2>Smart Dustbin ESP32-CAM</h2>"
    "<p>Status: <b style='color:#4ade80;'>ONLINE</b></p>"
    "<p>IP Address: <b>" + activeIP + "</b></p>"
    "<a class='btn-green' href='/capture' target='_blank'>Capture Live Image (/capture)</a>"
    "<a href='/status'>Device Status (/status)</a>"
    "</div></body></html>";
  server.send(200, "text/html", html);
}

// ==========================================
// 3. Setup & Initialization
// ==========================================
void setup() {
  // CRITICAL: Disable brownout detector to prevent reboot loop when camera sensor & Wi-Fi power spike
  #ifdef RTC_CNTL_BROWN_OUT_REG
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  #elif defined(RTC_CNTL_BROWNOUT_REG)
    WRITE_PERI_REG(RTC_CNTL_BROWNOUT_REG, 0);
  #endif

  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n========================================================");
  Serial.println("     Smart Dustbin - ESP32-CAM Capture Server v2.0      ");
  Serial.println("========================================================");

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW); // Keep off

  // Quick flash LED blink to indicate startup
  for (int i = 0; i < 2; i++) {
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(50);
    digitalWrite(FLASH_LED_PIN, LOW);
    delay(50);
  }

  // Camera Configuration
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 10000000;       // 10MHz (Guarantees signal stability on clone/MB boards)
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    Serial.println("[PSRAM] PSRAM found. Setting resolution to VGA (640x480).");
    config.frame_size = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 12;           // 10-12 crisp quality
    config.fb_count = 2;
  } else {
    Serial.println("[PSRAM] No PSRAM. Setting resolution to QVGA (320x240).");
    config.frame_size = FRAMESIZE_QVGA; // 320x240
    config.jpeg_quality = 14;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] Camera init failed with error 0x%x\n", err);
    Serial.println("Check OV2640 ribbon cable connector and re-seat it.");
    return;
  }
  Serial.println("[CAMERA] OV2640 Sensor initialized successfully.");

  // Wi-Fi Connection Routine with Auto-AP Failsafe
  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(200);
  WiFi.mode(WIFI_STA);

  Serial.printf("[WIFI] Connecting to SSID: '%s'...\n", STA_SSID);
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
    Serial.printf("[WIFI] Camera IP: %s\n", activeIP.c_str());
  } else {
    Serial.printf("\n[WIFI WARNING] Could not connect to '%s'. Starting Access Point...\n", STA_SSID);
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASSWORD);
    activeIP = WiFi.softAPIP().toString();
    Serial.printf("[AP ACTIVE] Hotspot: '%s' | Password: '%s'\n", AP_SSID, AP_PASSWORD);
    Serial.printf("[AP ACTIVE] Camera IP: http://%s\n", activeIP.c_str());
  }

  Serial.println("--------------------------------------------------------");
  Serial.printf("[URL] Camera Web:    http://%s/\n", activeIP.c_str());
  Serial.printf("[URL] Capture Frame: http://%s/capture\n", activeIP.c_str());
  Serial.printf("[URL] Device Status: http://%s/status\n", activeIP.c_str());
  Serial.println("--------------------------------------------------------\n");

  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/capture", handleCapture);
  server.begin();
  Serial.println("[SERVER] ESP32-CAM HTTP Server active on port 80.");
}

// ==========================================
// 4. Main Loop
// ==========================================
void loop() {
  server.handleClient();

  if (WiFi.getMode() == WIFI_STA) {
    static unsigned long lastCheck = 0;
    if (millis() - lastCheck > 15000) {
      lastCheck = millis();
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Connection lost. Reconnecting...");
        WiFi.reconnect();
      }
    }
  }
}
