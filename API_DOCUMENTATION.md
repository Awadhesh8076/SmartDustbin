# SmartDustbin — RESTful API Documentation

All endpoints are served by the FastAPI application under the default prefix `/api`.
Interactive OpenAPI documentation is accessible at `http://127.0.0.1:8000/docs`.

---

## 1. System Health & Core

### `GET /api/health`
Returns system health, database readiness, and storage status.
- **Response 200:**
  ```json
  {
    "status": "healthy",
    "service": "SmartDustbin Backend",
    "version": "1.0.0",
    "active_mode": "SIMULATION",
    "database": "connected",
    "storage_ready": true
  }
  ```

---

## 2. Waste Detection & Inference

### `POST /api/detection/scan`
Receives an image (JPEG, PNG, or WebP), performs aspect-ratio 1:1 center-crop, 128×128 bilinear resize, 32-D feature extraction, and Pearson correlation matching.
- **Request:** `multipart/form-data`
  - `file`: Image binary buffer (Max 10MB)
  - `source`: String (e.g. `BROWSER_CAMERA`, `UPLOAD`, `ESP32_CAM`)
- **Response 200:**
  ```json
  {
    "detection_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "image_url": "/api/static/scans/scan_9b1deb4d.jpg",
    "category": "PLASTIC",
    "confidence": 0.942,
    "confidence_level": "HIGH",
    "probabilities": {
      "WET": 0.02,
      "DRY": 0.01,
      "PLASTIC": 0.94,
      "METAL": 0.03
    },
    "is_known_in_memory": true,
    "similarity": 0.8841,
    "model_version": "v1.0",
    "requires_user_label": false,
    "message": "Classified as PLASTIC with high similarity."
  }
  ```

### `GET /api/detection/history`
Returns paginated historical scans.
- **Query Parameters:** `limit=20`, `offset=0`, `category=PLASTIC` (optional)
- **Response 200:**
  ```json
  {
    "total": 42,
    "items": [
      {
        "id": "...",
        "image_url": "/api/static/scans/scan_xxx.jpg",
        "detected_category": "PLASTIC",
        "confidence": 0.95,
        "confidence_level": "HIGH",
        "source": "UPLOAD",
        "created_at": "2026-11-23T14:30:00Z"
      }
    ]
  }
  ```

---

## 3. Continual Learning & Dataset Memory

### `POST /api/learning/teach`
Incorporates user ground-truth feedback via 1-shot online centroid adaptation and registers an exemplar.
- **Request Body:**
  ```json
  {
    "detection_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "confirmed_category": "METAL"
  }
  ```
- **Response 200:**
  ```json
  {
    "status": "SUCCESS",
    "sample_id": "...",
    "confirmed_category": "METAL",
    "was_corrected": true,
    "model_version": "v1.1",
    "total_samples": 12,
    "immediate_new_prediction": "METAL",
    "immediate_new_confidence": 0.95,
    "message": "Model memory adapted. Centroid updated."
  }
  ```

### `GET /api/learning/confusion-matrix`
Returns dynamic 4×4 predicted vs confirmed ground-truth matrix.
- **Response 200:**
  ```json
  {
    "matrix": {
      "WET": {"WET": 5, "DRY": 0, "PLASTIC": 0, "METAL": 0},
      "DRY": {"WET": 0, "DRY": 4, "PLASTIC": 0, "METAL": 0},
      "PLASTIC": {"WET": 0, "DRY": 0, "PLASTIC": 8, "METAL": 1},
      "METAL": {"WET": 0, "DRY": 0, "PLASTIC": 0, "METAL": 7}
    },
    "total_samples": 25,
    "accuracy_percent": 96.0,
    "categories": ["WET", "DRY", "PLASTIC", "METAL"]
  }
  ```

---

## 4. Sorting Actuation & Telemetry

### `POST /api/sorting/execute`
Executes dual-servo sorting actuation (virtual simulation or physical ESP32 DevKit dispatch).
- **Request Body:**
  ```json
  {
    "category": "METAL",
    "detection_id": "optional-uuid",
    "mode_override": "SIMULATION"
  }
  ```
- **Response 200:**
  ```json
  {
    "command_id": "...",
    "detection_id": "...",
    "status": "SUCCESS",
    "category": "METAL",
    "target_angle": 90,
    "mode": "SIMULATION",
    "coins_earned": 5,
    "balance_after": 35,
    "execution_duration_seconds": 2.7,
    "message": "[SIMULATION] Waste sorted into METAL compartment (90°). Earned +5 coins!"
  }
  ```

### `GET /api/sorting/history`
Returns paginated list of all physical and simulated sorting records.

### `GET /api/sorting/stats`
Returns total commands, successful sorts, failed sorts, and category breakdowns.

---

## 5. Eco Rewards & Store

### `GET /api/rewards/balance`
Returns spendable coin balance, lifetime earned, and lifetime spent.

### `GET /api/rewards/catalog`
Returns available Eco Store reward items (`R1`, `R2`, `R3`, `R4`).

### `POST /api/rewards/claim`
Redeems coins for a voucher code.
- **Request Body:** `{"reward_id": "R1"}`
- **Response 200:**
  ```json
  {
    "claim_id": "...",
    "reward_id": "R1",
    "reward_title": "₹10 Discount Voucher",
    "coin_cost": 20,
    "claim_code": "ECO-49102",
    "status": "CLAIMED",
    "balance_after": 15,
    "message": "Successfully claimed! Use code: ECO-49102",
    "created_at": "2026-11-23T14:32:00Z"
  }
  ```

---

## 6. Devices & Hardware

### `GET /api/devices/status`
Returns IP addresses, active mode, and microcontroller online statuses.

### `POST /api/devices/test-connection`
Non-actuating ping probe.
- **Request Body:** `{"device": "CAM", "ip": "192.168.4.10"}`
- **Response 200:** `{"device": "CAM", "ip": "192.168.4.10", "online": true, "status_message": "Reachable (24.2ms)"}`

### `POST /api/devices/mode`
Switches operating mode (`SIMULATION` or `REAL_HARDWARE`).

### `POST /api/devices/camera/capture`
Proxies capture from ESP32-CAM (or generates synthetic frame in Simulation Mode) and runs TinyML classification.

---

## 7. Settings & Maintenance

### `GET /api/settings` & `PUT /api/settings`
Read or update device network IPs and timeouts.

### `POST /api/settings/backup`
Creates an atomic, consistent SQLite backup in `storage/backups/`.

### `GET /api/settings/database-health`
Runs SQLite `PRAGMA integrity_check`.
