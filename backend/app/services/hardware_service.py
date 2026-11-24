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
    details: Optional[Dict] = None

class HardwareService:
    """
    Centralized communication service between FastAPI and physical microcontrollers.
    Enforces security, dynamic IP routing, detailed error diagnostics,
    timeout handling, JPEG validation, and deduplicated actuation.
    """

    @staticmethod
    async def ping_device(
        device_type: str,
        ip: str,
        timeout: float = 3.0
    ) -> DeviceStatus:
        """
        Pings an ESP32 microcontroller with a lightweight non-actuating HTTP probe.
        CAM uses GET / (or /status); DevKit uses GET /status.
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
                    details = {}
                    try:
                        details = resp.json()
                        is_busy = bool(details.get("busy", False))
                    except Exception:
                        pass

                    busy_str = " (BUSY)" if is_busy else ""
                    return DeviceStatus(
                        device=device_type,
                        ip=ip,
                        online=True,
                        status_message=f"Reachable ({latency}ms){busy_str}",
                        latency_ms=latency,
                        is_busy=is_busy,
                        details=details if details else None
                    )
                else:
                    return DeviceStatus(
                        device=device_type,
                        ip=ip,
                        online=False,
                        status_message=f"HTTP {resp.status_code}: {resp.reason_phrase}",
                        latency_ms=latency
                    )

        except httpx.ConnectTimeout:
            return DeviceStatus(
                device=device_type,
                ip=ip,
                online=False,
                status_message=f"Connection timed out after {timeout}s: Host at {ip} is not responding. Verify power and Wi-Fi connection.",
                latency_ms=None
            )
        except httpx.ConnectError as ce:
            return DeviceStatus(
                device=device_type,
                ip=ip,
                online=False,
                status_message=f"Connection refused at {ip}: Port 80 unreachable. Ensure firmware is running and AP isolation is disabled.",
                latency_ms=None
            )
        except httpx.TimeoutException:
            return DeviceStatus(
                device=device_type,
                ip=ip,
                online=False,
                status_message=f"Request timed out after {timeout}s awaiting device response.",
                latency_ms=None
            )
        except Exception as e:
            return DeviceStatus(
                device=device_type,
                ip=ip,
                online=False,
                status_message=f"Network error: {str(e)}",
                latency_ms=None
            )

    @staticmethod
    async def capture_frame_from_cam(
        ip: str,
        timeout: float = 6.0
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
                    detail=f"ESP32-CAM at {ip} returned HTTP {resp.status_code} ({resp.reason_phrase}). Ensure camera sensor is initialized."
                )

            image_bytes = resp.content
            if len(image_bytes) < 1024:
                raise HTTPException(
                    status_code=502,
                    detail=f"ESP32-CAM at {ip} returned an incomplete or truncated image buffer ({len(image_bytes)} bytes < 1KB minimum)."
                )

            # Validate JPEG magic bytes: FF D8
            if not image_bytes.startswith(b'\xff\xd8'):
                raise HTTPException(
                    status_code=502,
                    detail="Invalid image format received from ESP32-CAM: Missing JPEG header (0xFF 0xD8)."
                )

            return image_bytes

        except httpx.ConnectTimeout:
            raise HTTPException(
                status_code=504,
                detail=f"ESP32-CAM at {ip} connection timed out after {timeout}s. Check device power and Wi-Fi connection."
            )
        except httpx.ConnectError:
            raise HTTPException(
                status_code=502,
                detail=f"Cannot connect to ESP32-CAM at {ip}: Connection refused. Check if device is running on port 80."
            )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail=f"ESP32-CAM capture timed out after {timeout}s awaiting frame buffer."
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
        command_id: Optional[str] = None,
        timeout: float = 12.0
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Dispatches a physical sorting actuation command to ESP32 DevKit via GET /sort?type={category}&command_id={command_id}.
        Handles:
          - 200 OK -> SUCCESS
          - 400 Bad Request -> REJECTED (Zero-guessing policy or invalid category)
          - 429 -> BUSY (Sorter currently executing another cycle)
          - Timeout -> UNKNOWN (Command was dispatched, outcome uncertain; do not blindly retry)
          - Network error -> FAILED
        Returns (success_bool, message, response_dict).
        """
        category = category.upper()
        url = f"http://{ip}/sort?type={category}"
        if command_id:
            url += f"&command_id={command_id}"

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(url)

            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") in ["SUCCESS", "OK"]:
                    msg = data.get("message", "Physical sorting cycle confirmed by ESP32 DevKit.")
                    return True, msg, data
                else:
                    msg = data.get("message", "DevKit reported error during sort cycle.")
                    return False, f"DevKit error: {msg}", data

            elif resp.status_code == 429:
                return False, "ESP32 DevKit Sorter is currently busy executing another sort cycle (HTTP 429).", {"status": "BUSY"}

            elif resp.status_code == 400:
                data = {}
                try:
                    data = resp.json()
                except Exception:
                    pass
                msg = data.get("message", "Actuation rejected by DevKit firmware.")
                return False, f"DevKit rejected command (HTTP 400): {msg}", data

            else:
                return False, f"DevKit returned HTTP status {resp.status_code} ({resp.reason_phrase})", {"status": "HTTP_ERROR", "code": resp.status_code}

        except httpx.ConnectTimeout:
            return False, f"Could not connect to ESP32 DevKit at {ip}: Connection timed out.", {"status": "CONNECT_TIMEOUT"}
        except httpx.ConnectError:
            return False, f"Connection to ESP32 DevKit at {ip} refused. Ensure device is powered and connected to Wi-Fi.", {"status": "CONNECT_REFUSED"}
        except httpx.TimeoutException:
            # Critical IoT condition: Command was dispatched, outcome uncertain
            raise HTTPException(
                status_code=504,
                detail=f"Timeout awaiting ESP32 DevKit confirmation after {timeout}s. Command outcome is UNKNOWN. Do not retry automatically."
            )
        except Exception as e:
            return False, f"Hardware communication failed: {str(e)}", {"status": "NETWORK_ERROR", "error": str(e)}

hardware_service = HardwareService()
