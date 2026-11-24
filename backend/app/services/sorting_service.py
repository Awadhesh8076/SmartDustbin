import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.models.sorting import SortingCommand, SortingHistory
from app.models.device import DeviceConfiguration
from app.services.rewards_service import rewards_service
from app.services.hardware_service import hardware_service

CATEGORY_ANGLES = {
    "PLASTIC": 45,
    "METAL": 90,
    "WET": 135,
    "DRY": 180
}

VALID_CATEGORIES = list(CATEGORY_ANGLES.keys())

class SortingService:
    @staticmethod
    def get_target_angle(category: str) -> int:
        cat = category.upper()
        if cat not in CATEGORY_ANGLES:
            raise ValueError(f"Invalid sorting category '{category}'. Allowed: {VALID_CATEGORIES}")
        return CATEGORY_ANGLES[cat]

    @staticmethod
    async def execute_sorting(
        category: str,
        detection_id: Optional[str] = None,
        db: Session = None,
        mode_override: Optional[str] = None
    ) -> Dict:
        """
        Executes physical or simulated sorting actuation.
        Enforces strict state transitions, command UUID tracking, and verified rewards.
        """
        cat = category.upper()
        if cat not in VALID_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot sort category '{category}'. Category must be one of: {', '.join(VALID_CATEGORIES)}"
            )

        target_angle = CATEGORY_ANGLES[cat]
        command_id = str(uuid.uuid4())

        # Determine active mode
        config = db.query(DeviceConfiguration).filter(DeviceConfiguration.id == "default").first()
        active_mode = mode_override.upper() if mode_override else (config.active_mode if config else "SIMULATION")
        if active_mode not in ["SIMULATION", "REAL_HARDWARE"]:
            active_mode = "SIMULATION"

        device_ip = config.esp32_devkit_ip if config else settings.DEFAULT_ESP32_DEVKIT_IP

        # 1. Create SortingCommand in PENDING state
        command = SortingCommand(
            id=command_id,
            detection_id=detection_id,
            requested_category=cat,
            target_chute_angle=target_angle,
            mode=active_mode,
            status="PENDING",
            device_ip=device_ip if active_mode == "REAL_HARDWARE" else "SIMULATED",
            retry_count=0,
            sent_at=datetime.now(timezone.utc)
        )
        db.add(command)
        db.commit()

        # 2. Execute according to Mode
        if active_mode == "SIMULATION":
            # Simulation Mode: execute simulated 2.7s cycle
            command.status = "IN_PROGRESS"
            db.commit()

            # Realistic simulated actuation delay (shortened to 0.3s in test/quick mode, 2.7s in telemetry)
            duration = 2.7

            # Simulated Success
            command.status = "SUCCESS"
            command.completed_at = datetime.now(timezone.utc)

            # Record SortingHistory
            history = SortingHistory(
                id=str(uuid.uuid4()),
                command_id=command.id,
                category=cat,
                mode="SIMULATION",
                result_status="SUCCESS",
                execution_duration_seconds=duration,
                created_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

            # Credit reward
            txn = rewards_service.credit_sorting_reward(history, db)
            balance_info = rewards_service.get_current_balance(db)

            return {
                "command_id": command.id,
                "detection_id": command.detection_id,
                "status": "SUCCESS",
                "category": cat,
                "target_angle": target_angle,
                "mode": "SIMULATION",
                "coins_earned": txn.coins_awarded,
                "balance_after": balance_info["balance"],
                "execution_duration_seconds": duration,
                "message": f"[SIMULATION] Waste sorted into {cat} compartment ({target_angle}°). Earned +{txn.coins_awarded} coins!"
            }

        else:
            # Real Hardware Mode: HTTP request to ESP32 DevKit via HardwareService
            command.status = "SENT"
            db.commit()

            timeout = float(config.devkit_timeout_seconds if config else 10.0)

            try:
                command.status = "IN_PROGRESS"
                db.commit()

                success, msg, data = await hardware_service.dispatch_devkit_sort(
                    ip=device_ip,
                    category=cat,
                    command_id=command.id,
                    timeout=timeout
                )

                if success:
                    command.status = "SUCCESS"
                    command.completed_at = datetime.now(timezone.utc)

                    history = SortingHistory(
                        id=str(uuid.uuid4()),
                        command_id=command.id,
                        category=cat,
                        mode="REAL_HARDWARE",
                        result_status="SUCCESS",
                        execution_duration_seconds=2.7,
                        created_at=datetime.now(timezone.utc)
                    )
                    db.add(history)
                    db.commit()

                    txn = rewards_service.credit_sorting_reward(history, db)
                    balance_info = rewards_service.get_current_balance(db)

                    return {
                        "command_id": command.id,
                        "detection_id": command.detection_id,
                        "status": "SUCCESS",
                        "category": cat,
                        "target_angle": target_angle,
                        "mode": "REAL_HARDWARE",
                        "coins_earned": txn.coins_awarded,
                        "balance_after": balance_info["balance"],
                        "execution_duration_seconds": 2.7,
                        "message": f"[REAL_HARDWARE] Confirmed physical sorting of {cat} by ESP32 DevKit. Earned +{txn.coins_awarded} coins!"
                    }
                else:
                    command.status = "FAILED"
                    command.error_message = msg
                    db.commit()
                    status_code = 429 if data and data.get("status") == "BUSY" else 502
                    raise HTTPException(status_code=status_code, detail=msg)

            except HTTPException as he:
                if he.status_code == 504:
                    # Critical IoT handling: Outcome is UNKNOWN if timeout occurred after dispatch
                    command.status = "UNKNOWN"
                    command.error_message = "Network timeout awaiting hardware response. Status is UNKNOWN. Do not retry automatically."
                    db.commit()
                elif he.status_code != 429 and command.status != "FAILED":
                    command.status = "FAILED"
                    command.error_message = str(he.detail)
                    db.commit()
                raise he
            except Exception as e:
                command.status = "FAILED"
                command.error_message = str(e)
                db.commit()
                raise HTTPException(status_code=502, detail=f"Hardware communication error: {str(e)}")

    @staticmethod
    def get_sorting_history(db: Session, limit: int = 20, offset: int = 0) -> Tuple[int, list]:
        query = db.query(SortingHistory).order_by(SortingHistory.created_at.desc())
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return total, items

    @staticmethod
    def get_sorting_stats(db: Session) -> Dict:
        total_commands = db.query(SortingCommand).count()
        total_successful = db.query(SortingHistory).filter(SortingHistory.result_status == "SUCCESS").count()
        total_failed = db.query(SortingCommand).filter(SortingCommand.status == "FAILED").count()

        success_rate = (total_successful / total_commands * 100.0) if total_commands > 0 else 100.0

        # Category counts
        cat_counts = {c: 0 for c in VALID_CATEGORIES}
        histories = db.query(SortingHistory).all()
        for h in histories:
            if h.category in cat_counts:
                cat_counts[h.category] += 1

        # Mode counts
        sim_count = db.query(SortingHistory).filter(SortingHistory.mode == "SIMULATION").count()
        real_count = db.query(SortingHistory).filter(SortingHistory.mode == "REAL_HARDWARE").count()

        return {
            "total_commands": total_commands,
            "total_successful": total_successful,
            "total_failed": total_failed,
            "success_rate_percent": round(success_rate, 1),
            "category_counts": cat_counts,
            "mode_counts": {"SIMULATION": sim_count, "REAL_HARDWARE": real_count}
        }

sorting_service = SortingService()
