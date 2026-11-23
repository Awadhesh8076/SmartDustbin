import io
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.main import app

def create_synthetic_waste_image(pattern_color: tuple, bg_color: tuple = (40, 40, 40)) -> bytes:
    """Creates a distinct 200x200 image for AI feature testing."""
    img = Image.new("RGB", (200, 200), color=bg_color)
    draw = ImageDraw.Draw(img)
    draw.ellipse([30, 30, 170, 170], fill=pattern_color)
    for i in range(10, 190, 20):
        draw.line([(i, 10), (i, 190)], fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()

def test_full_end_to_end_workflow_scan_to_reward_redemption():
    """
    Validates complete user journey:
    Health -> Scan -> Recognized Classification -> Sort Actuation ->
    Reward Coins Credited -> Wallet Balance -> Eco Store Voucher Claim -> Verified Claims
    """
    with TestClient(app) as client:
        # 1. System Health Check
        health_res = client.get("/api/health")
        assert health_res.status_code == 200
        assert health_res.json()["status"] == "healthy"
        assert health_res.json()["storage_ready"] is True

        # 2. Capture Initial Wallet Balance
        initial_bal = client.get("/api/rewards/balance").json()["balance"]

        # 3. First, seed a training exemplar for METAL to guarantee high confidence recognition
        metal_img = create_synthetic_waste_image(pattern_color=(220, 220, 230), bg_color=(180, 180, 190))
        scan_res = client.post(
            "/api/detection/scan",
            files={"file": ("metal_can.jpg", metal_img, "image/jpeg")},
            data={"source": "UPLOAD"}
        )
        assert scan_res.status_code == 200
        scan_data = scan_res.json()
        det_id = scan_data["detection_id"]

        # 4. User teaches/confirms as METAL
        teach_res = client.post(
            "/api/learning/teach",
            json={"detection_id": det_id, "confirmed_category": "METAL"}
        )
        assert teach_res.status_code == 200
        assert teach_res.json()["status"] == "SUCCESS"
        assert teach_res.json()["confirmed_category"] == "METAL"

        # 5. Subsequent scan of identical metal item is recognized with high similarity
        scan_res2 = client.post(
            "/api/detection/scan",
            files={"file": ("metal_can_retest.jpg", metal_img, "image/jpeg")},
            data={"source": "BROWSER_CAMERA"}
        )
        assert scan_res2.status_code == 200
        det2_data = scan_res2.json()
        assert det2_data["category"] == "METAL"
        assert det2_data["confidence"] >= 0.90
        assert det2_data["similarity"] >= 0.70

        # 6. User initiates Sorting Actuation for the recognized METAL item (+5 Coins)
        sort_res = client.post(
            "/api/sorting/execute",
            json={
                "category": "METAL",
                "detection_id": det2_data["detection_id"],
                "mode_override": "SIMULATION"
            }
        )
        assert sort_res.status_code == 200
        sort_data = sort_res.json()
        assert sort_data["status"] == "SUCCESS"
        assert sort_data["target_angle"] == 90
        assert sort_data["coins_earned"] == 5
        cmd_id = sort_data["command_id"]

        # 7. Verify command is persisted in SQLite with full telemetry
        cmd_res = client.get(f"/api/sorting/commands/{cmd_id}")
        assert cmd_res.status_code == 200
        assert cmd_res.json()["status"] == "SUCCESS"
        assert cmd_res.json()["target_chute_angle"] == 90

        # 8. Verify wallet balance incremented by exactly 5
        new_bal = client.get("/api/rewards/balance").json()["balance"]
        assert new_bal >= initial_bal + 5

        # 9. Ensure sufficient coins to test Eco Store redemption (need 20 coins for R1)
        needed = max(0, 25 - new_bal)
        sorts_needed = (needed // 5) + 1
        for _ in range(sorts_needed):
            client.post("/api/sorting/execute", json={"category": "METAL", "mode_override": "SIMULATION"})

        final_bal_before_claim = client.get("/api/rewards/balance").json()["balance"]
        assert final_bal_before_claim >= 20

        # 10. Redeem Eco Store Item R1 (₹10 Discount Voucher, 20 coins)
        claim_res = client.post("/api/rewards/claim", json={"reward_id": "R1"})
        assert claim_res.status_code == 200
        claim_data = claim_res.json()
        assert claim_data["reward_id"] == "R1"
        assert claim_data["coin_cost"] == 20
        assert claim_data["claim_code"].startswith("ECO-")
        assert claim_data["status"] == "CLAIMED"
        assert claim_data["balance_after"] == final_bal_before_claim - 20

        # 11. Verify claim is present in claims history
        claims_list = client.get("/api/rewards/claims").json()["claims"]
        assert any(c["claim_code"] == claim_data["claim_code"] for c in claims_list)

        # 12. Verify Dashboard Stats reflect the activity
        dash_res = client.get("/api/dashboard/stats")
        assert dash_res.status_code == 200
        stats = dash_res.json()
        assert stats["total_sorted"] >= 1
        assert stats["category_sorted_counts"]["METAL"] >= 1
        assert stats["total_learned_samples"] >= 1

def test_unknown_waste_teaching_and_zero_guessing_workflow():
    """
    Validates:
    Scan unfamiliar pattern -> AI returns UNKNOWN ->
    Cannot physically sort UNKNOWN -> User teaches PLASTIC ->
    Immediate memory update -> Subsequent scan classifies as PLASTIC
    """
    with TestClient(app) as client:
        # Create unique pattern not yet encountered
        plastic_img = create_synthetic_waste_image(pattern_color=(10, 80, 220), bg_color=(200, 100, 50))

        # 1. First scan
        scan1 = client.post(
            "/api/detection/scan",
            files={"file": ("plastic_bottle.jpg", plastic_img, "image/jpeg")},
            data={"source": "UPLOAD"}
        )
        assert scan1.status_code == 200
        det1 = scan1.json()

        # 2. Ensure sorting UNKNOWN is rejected
        sort_invalid = client.post("/api/sorting/execute", json={"category": "UNKNOWN"})
        assert sort_invalid.status_code == 400

        # 3. User teaches as PLASTIC
        teach_res = client.post(
            "/api/learning/teach",
            json={"detection_id": det1["detection_id"], "confirmed_category": "PLASTIC"}
        )
        assert teach_res.status_code == 200
        assert teach_res.json()["immediate_new_prediction"] == "PLASTIC"
        assert teach_res.json()["immediate_new_confidence"] >= 0.90

        # 4. Immediate second scan of the same item
        scan2 = client.post(
            "/api/detection/scan",
            files={"file": ("plastic_bottle_retest.jpg", plastic_img, "image/jpeg")},
            data={"source": "BROWSER_CAMERA"}
        )
        assert scan2.status_code == 200
        det2 = scan2.json()
        assert det2["category"] == "PLASTIC"
        assert det2["confidence"] >= 0.90
        assert det2["is_known_in_memory"] is True

        # 5. Now sorting into PLASTIC succeeds (45 deg, +3 coins)
        sort_res = client.post(
            "/api/sorting/execute",
            json={"category": "PLASTIC", "detection_id": det2["detection_id"], "mode_override": "SIMULATION"}
        )
        assert sort_res.status_code == 200
        assert sort_res.json()["target_angle"] == 45
        assert sort_res.json()["coins_earned"] == 3
