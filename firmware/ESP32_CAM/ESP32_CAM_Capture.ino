/*
 * =========================================================================
 * SmartDustbin ESP32-CAM (ULTIMATE WORKING - ESP32-CAM-MB Compatible)
 * Board: AI Thinker ESP32-CAM
 * Settings: Tools -> PSRAM: Enabled | Partition: Huge APP (3MB)
 * SSID: SmartDustbin | Password: dustbin1234
 * Static IP: 192.168.4.1
 * =========================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

const char* ap_ssid = "SmartDustbin";
const char* ap_password = "dustbin1234";

WebServer server(80);

// AI-Thinker Camera Pins
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

void handleCapture() {
  // Clear any old/stale frame from DMA memory
  camera_fb_t * old_fb = esp_camera_fb_get();
  if (old_fb) esp_camera_fb_return(old_fb);

  // Briefly pulse flash LED to illuminate waste in hatch
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(40);

  // Capture real frame
  camera_fb_t * fb = esp_camera_fb_get();
  digitalWrite(FLASH_LED_PIN, LOW);

  if (!fb) {
    Serial.println("[CAM ERROR] esp_camera_fb_get returned NULL!");
    server.send(500, "text/plain", "Camera Sensor Buffer NULL");
    return;
  }

  Serial.printf("[CAM OK] Image Captured! Size: %u bytes\n", fb->len);

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Content-Type", "image/jpeg");
  server.sendHeader("Content-Disposition", "inline; filename=capture.jpg");
  server.send_P(200, "image/jpeg", (const char *)fb->buf, fb->len);
  
  esp_camera_fb_return(fb);
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"device\":\"ESP32-CAM\",\"status\":\"ONLINE\"}");
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", 
    "<h2>Smart Dustbin ESP32-CAM Online</h2>"
    "<p><a href='/capture'>Click to test image capture (/capture)</a></p>"
  );
}

void setup() {
  // Disable brownout detector for USB / MB daughterboard power spikes
  #ifdef RTC_CNTL_BROWN_OUT_REG
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  #elif defined(RTC_CNTL_BROWNOUT_REG)
    WRITE_PERI_REG(RTC_CNTL_BROWNOUT_REG, 0);
  #endif

  Serial.begin(115200);
  delay(500);
  Serial.println("\n[INIT] Starting SmartDustbin ESP32-CAM...");

  pinMode(FLASH_LED_PIN, OUTPUT);
  // Blink 3 times to signal boot start
  for (int i = 0; i < 3; i++) {
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(80);
    digitalWrite(FLASH_LED_PIN, LOW);
    delay(80);
  }

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
  config.xclk_freq_hz = 10000000;       // 10MHz (Guarantees signal stability on MB boards)
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA;   // 320x240 (Fits in internal RAM even if PSRAM fails)
  config.jpeg_quality = 14;
  config.fb_count = 1;
  config.grab_mode = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] Camera init failed: 0x%x\n", err);
  } else {
    Serial.println("[OK] Camera Hardware Initialized Successfully!");
  }

  // Set camera sensor options
  sensor_t * s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 1);     // Increase brightness slightly
    s->set_saturation(s, 0);
  }

  // Start Access Point & DHCP
  WiFi.mode(WIFI_AP);
  IPAddress apIP(192, 168, 4, 1);
  IPAddress netMask(255, 255, 255, 0);
  WiFi.softAPConfig(apIP, apIP, netMask);
  WiFi.softAP(ap_ssid, ap_password);

  Serial.println("\n==============================================");
  Serial.printf("[AP ONLINE] SSID: %s\n", ap_ssid);
  Serial.printf("[AP ONLINE] Pass: %s\n", ap_password);
  Serial.print("[AP ONLINE] Stream: http://");
  Serial.print(WiFi.softAPIP());
  Serial.println("/capture");
  Serial.println("==============================================\n");

  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/capture", handleCapture);
  server.begin();
  Serial.println("[SERVER] Camera HTTP Server listening on port 80");
}

void loop() {
  server.handleClient();
}
