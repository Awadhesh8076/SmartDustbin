/*
 * =========================================================================
 * Smart Dustbin - ESP32-CAM Capture Server
 * Board: AI Thinker ESP32-CAM
 * Description: Hosts a lightweight HTTP server serving real-time JPEG captures 
 *              to the Unity Mobile application.
 * =========================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

// ==========================================
// 1. WiFi Configuration
// Replace with your local WiFi credentials
// ==========================================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Optional: Configure Static IP (Recommended for predictable Unity connection)
IPAddress local_IP(192, 168, 4, 10);
IPAddress gateway(192, 168, 4, 1);
IPAddress subnet(255, 255, 255, 0);

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

// ==========================================
// 3. HTTP /capture Handler
// ==========================================
void handleCapture() {
  camera_fb_t * fb = esp_camera_fb_get();
  digitalWrite(FLASH_LED_PIN, LOW);

  if (!fb) {
    Serial.println("[ERROR] Camera capture failed");
    server.send(500, "text/plain", "Camera Capture Failed");
    return;
  }

  // Allow cross-origin requests from any client
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send_P(200, "image/jpeg", (const char *)fb->buf, fb->len);
  
  esp_camera_fb_return(fb);
}

void handleRoot() {
  server.send(200, "text/html", "<h2>Smart Dustbin ESP32-CAM is Online</h2><p><a href='/capture'>Click to test /capture</a></p>");
}

void setup() {
  // Disable brownout detector for USB / MB daughterboard power spikes
  #ifdef RTC_CNTL_BROWN_OUT_REG
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  #elif defined(RTC_CNTL_BROWNOUT_REG)
    WRITE_PERI_REG(RTC_CNTL_BROWNOUT_REG, 0);
  #endif

  Serial.begin(115200);
  Serial.println("\n[INIT] Starting Smart Dustbin ESP32-CAM...");

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

  // Frame size & quality configuration
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA; // 640x480
    config.jpeg_quality = 10;          // 0-63 (lower is higher quality)
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA; // 320x240
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] Camera init failed with error 0x%x\n", err);
    return;
  }

  // Adjust camera sensor orientation if needed
  sensor_t * s = esp_camera_sensor_get();
  s->set_vflip(s, 0); // 1 to flip vertically
  s->set_hmirror(s, 0); // 1 to mirror horizontally

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
  Serial.print("[WIFI] Camera Stream IP: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/capture");

  // Route Handlers
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/capture", handleCapture);
  server.begin();
  Serial.println("[SERVER] HTTP Server started");
}

void loop() {
  server.handleClient();
}
