import time
from typing import Dict, Optional, Tuple
import httpx
from fastapi import HTTPException
from pydantic import BaseModel

class DeviceStatus(BaseModel):
    device: str
    ip: str
    online: bool
    status_message: str
    latency_ms: Optional[float] = None
    is_busy: Optional[bool] = None

class HardwareService:
    """
    Centralized communication service between FastAPI and physical microcontrollers.
    Enforces security, connection testing, timeout handling, JPEG validation,
    and HTTP 429 BUSY response handling.
    """

    @staticmethod
    async def ping_device(
        device_type: str,
        ip: str,
        timeout: float = 3.0
    ) -> DeviceStatus:
        """
        Pings an ESP32 microcontroller with a lightweight non-actuating HTTP probe.
        CAM uses GET /; DevKit uses GET /status.
        """
        device_type = device_type.upper()
        probe_url = f"http://{ip}/" if device_type == "CAM" else f"http://{ip}/status"
        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(probe_url)
                latency = round((time.time() - start_time) * 1000.0, 1)

                if resp.status_code == 200:
                    is_busy = False
                    if device_type == "DEVKIT":
                        try:
                            data = resp.json()
                            is_busy = bool(data.get("busy", False))
                        except Exception:
                            pass

                    busy_str = " (BUSY)" if is_busy else ""
                    return DeviceStatus(
                        device=device_type,
                        ip=ip,
                        online=True,
                        status_message=f"Reachable ({latency}ms){busy_str}",
                        latency_ms=latency,
                        is_busy=is_busy
                    )
                else:
                    return DeviceStatus(
                        device=device_type,
                        ip=ip,
                        online=False,
                        status_message=f"HTTP {resp.status_code}",
                        latency_ms=latency
                    )

        except httpx.TimeoutException:
            return DeviceStatus(
                device=device_type,
                ip=ip,
                online=False,
                status_message=f"Connection timed out after {timeout}s",
                latency_ms=None
            )
        except Exception as e:
            return DeviceStatus(
                device=device_type,
                ip=ip,
                online=False,
                status_message=f"Unreachable: {str(e)}",
                latency_ms=None
            )

    @staticmethod
    async def capture_frame_from_cam(
        ip: str,
        timeout: float = 5.0
    ) -> bytes:
        """
        Captures a raw JPEG image frame from the ESP32-CAM via GET /capture.
        Validates HTTP status code, non-empty response, minimum image size, and JPEG magic header (0xFF 0xD8).
        """
        url = f"http://{ip}/capture"
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(url)

            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"ESP32-CAM returned HTTP {resp.status_code}"
                )

            image_bytes = resp.content
            if len(image_bytes) < 1024:
                raise HTTPException(
                    status_code=502,
                    detail="ESP32-CAM returned an incomplete or truncated image buffer (< 1KB)."
                )

            # Validate JPEG magic bytes: FF D8 ... FF D9
            if not image_bytes.startswith(b'\xff\xd8'):
                raise HTTPException(
                    status_code=502,
                    detail="Invalid image format received from ESP32-CAM: Missing JPEG header (0xFF 0xD8)."
                )

            return image_bytes

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail=f"ESP32-CAM capture request timed out after {timeout}s. Check device power and WiFi connection."
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to communicate with ESP32-CAM at {ip}: {str(e)}"
            )

    @staticmethod
    async def dispatch_devkit_sort(
        ip: str,
        category: str,
        timeout: float = 12.0
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Dispatches a physical sorting actuation command to ESP32 DevKit via GET /sort?type={category}.
        Handles:
          - 200 OK -> SUCCESS
          - 429 -> BUSY (Sorter currently executing another cycle)
          - Timeout -> UNKNOWN (Command was sent, but confirmation not received; DO NOT retry blindly)
          - Network error -> FAILED
        Returns (success_bool, message, response_dict).
        """
        category = category.upper()
        url = f"http://{ip}/sort?type={category}"

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(url)

            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") in ["SUCCESS", "OK"]:
                    return True, "Physical sorting cycle confirmed by ESP32 DevKit.", data
                else:
                    msg = data.get("message", "DevKit reported error during sort cycle.")
                    return False, f"DevKit error: {msg}", data

            elif resp.status_code == 429:
                # Sorter mechanism is currently busy
                return False, "ESP32 DevKit Sorter is currently busy executing another sort cycle (HTTP 429).", {"status": "BUSY"}

            else:
                return False, f"DevKit returned HTTP status {resp.status_code}", {"status": "HTTP_ERROR", "code": resp.status_code}

        except httpx.TimeoutException:
            # Critical IoT condition: Command may have reached DevKit, but response timed out.
            # Must remain UNKNOWN rather than falsely claiming failure or blindly retrying.
            raise HTTPException(
                status_code=504,
                detail="Timeout awaiting ESP32 DevKit confirmation. Command outcome is UNKNOWN. Do not retry automatically."
            )
        except Exception as e:
            return False, f"Hardware communication failed: {str(e)}", {"status": "NETWORK_ERROR", "error": str(e)}

hardware_service = HardwareService()
