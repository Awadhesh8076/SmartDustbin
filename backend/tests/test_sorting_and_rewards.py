from fastapi.testclient import TestClient
from app.main import app

def test_sorting_execute_simulation_all_categories():
    with TestClient(app) as client:
        # Test all 4 valid categories and angles
        cases = [
            ("PLASTIC", 45, 3),
            ("METAL", 90, 5),
            ("WET", 135, 1),
            ("DRY", 180, 2)
        ]
        for cat, expected_angle, expected_coins in cases:
            res = client.post(
                "/api/sorting/execute",
                json={"category": cat, "mode_override": "SIMULATION"}
            )
            assert res.status_code == 200, res.text
            data = res.json()
            assert data["status"] == "SUCCESS"
            assert data["category"] == cat
            assert data["target_angle"] == expected_angle
            assert data["mode"] == "SIMULATION"
            assert data["coins_earned"] == expected_coins
            assert data["execution_duration_seconds"] == 2.7
            assert "command_id" in data

def test_sorting_execute_rejects_unknown_or_invalid():
    with TestClient(app) as client:
        # UNKNOWN cannot be sorted physically
        res_unknown = client.post(
            "/api/sorting/execute",
            json={"category": "UNKNOWN"}
        )
        assert res_unknown.status_code == 400
        assert "Cannot sort" in res_unknown.json()["detail"]

        # Random string cannot be sorted
        res_invalid = client.post(
            "/api/sorting/execute",
            json={"category": "GLASS"}
        )
        assert res_invalid.status_code == 400

def test_sorting_history_and_stats():
    with TestClient(app) as client:
        # Execute one sort
        res = client.post(
            "/api/sorting/execute",
            json={"category": "METAL", "mode_override": "SIMULATION"}
        )
        cmd_id = res.json()["command_id"]

        # Query history
        res_hist = client.get("/api/sorting/history?limit=10")
        assert res_hist.status_code == 200
        hist_data = res_hist.json()
        assert hist_data["total"] >= 1
        assert any(item["command_id"] == cmd_id for item in hist_data["items"])

        # Query stats
        res_stats = client.get("/api/sorting/stats")
        assert res_stats.status_code == 200
        stats = res_stats.json()
        assert stats["total_commands"] >= 1
        assert stats["total_successful"] >= 1
        assert stats["success_rate_percent"] > 0
        assert "METAL" in stats["category_counts"]

        # Query single command
        res_cmd = client.get(f"/api/sorting/commands/{cmd_id}")
        assert res_cmd.status_code == 200
        cmd_details = res_cmd.json()
        assert cmd_details["id"] == cmd_id
        assert cmd_details["requested_category"] == "METAL"
        assert cmd_details["target_chute_angle"] == 90
        assert cmd_details["status"] == "SUCCESS"

def test_rewards_balance_catalog_and_claims():
    with TestClient(app) as client:
        # 1. Fetch catalog
        res_cat = client.get("/api/rewards/catalog")
        assert res_cat.status_code == 200
        catalog = res_cat.json()["items"]
        assert len(catalog) == 4
        assert any(item["id"] == "R1" and item["coin_cost"] == 20 for item in catalog)
        assert any(item["id"] == "R4" and item["coin_cost"] == 100 for item in catalog)

        # 2. Check current balance
        res_bal = client.get("/api/rewards/balance")
        assert res_bal.status_code == 200
        initial_balance = res_bal.json()["balance"]

        # 3. If balance < 20, try claiming and expect 400 Insufficient Coins
        if initial_balance < 20:
            res_fail = client.post("/api/rewards/claim", json={"reward_id": "R1"})
            assert res_fail.status_code == 400
            assert "Insufficient coins" in res_fail.json()["detail"]

        # 4. Earn enough coins by sorting METAL (+5 each)
        needed = max(0, 25 - initial_balance)
        sorts_needed = (needed // 5) + 1
        for _ in range(sorts_needed):
            client.post("/api/sorting/execute", json={"category": "METAL", "mode_override": "SIMULATION"})

        res_bal2 = client.get("/api/rewards/balance")
        current_balance = res_bal2.json()["balance"]
        assert current_balance >= 20

        # 5. Successfully claim R1 (₹10 Voucher, 20 coins)
        res_claim = client.post("/api/rewards/claim", json={"reward_id": "R1"})
        assert res_claim.status_code == 200
        claim_data = res_claim.json()
        assert claim_data["reward_id"] == "R1"
        assert claim_data["coin_cost"] == 20
        assert claim_data["claim_code"].startswith("ECO-")
        assert claim_data["status"] == "CLAIMED"
        assert claim_data["balance_after"] == current_balance - 20

        # 6. Verify claim appears in claims list
        res_claims = client.get("/api/rewards/claims")
        assert res_claims.status_code == 200
        all_claims = res_claims.json()["claims"]
        assert any(c["claim_code"] == claim_data["claim_code"] for c in all_claims)

        # 7. Verify reward transactions history
        res_txns = client.get("/api/rewards/history")
        assert res_txns.status_code == 200
        assert res_txns.json()["total"] > 0

def test_dashboard_and_analytics_endpoints():
    with TestClient(app) as client:
        # Dashboard stats
        res_dash = client.get("/api/dashboard/stats")
        assert res_dash.status_code == 200
        dash = res_dash.json()
        assert "total_detected" in dash
        assert "total_sorted" in dash
        assert "category_counts" in dash
        assert "current_coin_balance" in dash
        assert "active_mode" in dash
        assert "model_version" in dash

        # Recent activity
        res_act = client.get("/api/dashboard/recent-activity")
        assert res_act.status_code == 200
        activities = res_act.json()["activities"]
        assert isinstance(activities, list)

        # Analytics trends
        res_trends = client.get("/api/analytics/trends")
        assert res_trends.status_code == 200
        trends = res_trends.json()
        assert "category_distribution" in trends
        assert "sorting_distribution" in trends
        assert "success_rate" in trends
        assert "timeline" in trends
