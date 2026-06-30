import asyncio
import threading
from datetime import datetime

import serial
from serial.tools import list_ports

from .config import DEFAULT_BAUDRATE, SERIAL_TIMEOUT


class BluetoothManager:
    """Port of SerialThread from desktop app. Reads serial data in background thread,
    pushes parsed ECG samples into an asyncio.Queue for consumption by other modules."""

    def __init__(self):
        self.ser = None
        self.is_running = False
        self._thread = None
        self._loop = None
        self._port = None
        self._baudrate = DEFAULT_BAUDRATE
        self._is_bluetooth = False
        self.data_queue = asyncio.Queue(maxsize=2000)
        self.latest_battery = 0
        self.on_status_change = None  # async callback

    @staticmethod
    def list_ports():
        ports = list_ports.comports()
        result = []
        for port in ports:
            check_desc = "bluetooth" in port.description.lower()
            check_dev = "rfcomm" in port.device.lower()
            is_bt = check_desc or check_dev
            result.append({
                "device": port.device,
                "description": port.description,
                "is_bluetooth": is_bt,
            })
        return result

    async def connect(self, port: str, baudrate: int = DEFAULT_BAUDRATE):
        if self.is_running:
            await self.disconnect()

        self._port = port
        self._baudrate = baudrate
        self._loop = asyncio.get_event_loop()
        self.is_running = True

        self._thread = threading.Thread(target=self._serial_read_loop, daemon=True)
        self._thread.start()

    async def disconnect(self):
        self.is_running = False
        if self.ser and self.ser.is_open:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)
        self._thread = None
        if self.on_status_change:
            await self.on_status_change("Disconnected")

    def _serial_read_loop(self):
        try:
            if self.on_status_change:
                asyncio.run_coroutine_threadsafe(
                    self.on_status_change(f"Connecting to {self._port}..."), self._loop
                )

            self.ser = serial.Serial(self._port, self._baudrate, timeout=SERIAL_TIMEOUT)
            self._detect_bluetooth()

            if self.on_status_change:
                asyncio.run_coroutine_threadsafe(
                    self.on_status_change(f"Connected: {self._port}"), self._loop
                )

            while self.is_running:
                if not self.ser.is_open:
                    break
                try:
                    if self.ser.in_waiting:
                        line = self.ser.readline().decode("utf-8", errors="ignore").strip()
                        if line:
                            self._parse_ecg_data(line)
                    else:
                        import time
                        time.sleep(0.01)
                except OSError:
                    break

        except serial.SerialException as e:
            if self.is_running and self.on_status_change:
                asyncio.run_coroutine_threadsafe(
                    self.on_status_change(f"Serial Error: {e}"), self._loop
                )
        except Exception as e:
            if self.is_running and self.on_status_change:
                asyncio.run_coroutine_threadsafe(
                    self.on_status_change(f"Unexpected Error: {e}"), self._loop
                )
        finally:
            if self.ser and self.ser.is_open:
                try:
                    self.ser.close()
                except Exception:
                    pass
            if self.is_running:
                self.is_running = False
                if self.on_status_change:
                    asyncio.run_coroutine_threadsafe(
                        self.on_status_change("Disconnected"), self._loop
                    )

    def _detect_bluetooth(self):
        if self.ser and self.ser.name:
            port_name = self.ser.name.lower()
            self._is_bluetooth = "rfcomm" in port_name or "bluetooth" in port_name

    def _parse_ecg_data(self, line: str):
        """Port of SerialThread.parse_ecg_data - identical logic."""
        try:
            parts = line.split(",")
            if len(parts) >= 3:
                data = {
                    "Lead_I": int(parts[0]),
                    "CH1_LA": int(parts[1]),
                    "CH2_RA": int(parts[2]),
                }
                if len(parts) == 4:
                    data["BATT"] = int(parts[3])
                    self.latest_battery = data["BATT"]

                try:
                    self.data_queue.put_nowait(data)
                except asyncio.QueueFull:
                    # Drop oldest to prevent blocking
                    try:
                        self.data_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                    try:
                        self.data_queue.put_nowait(data)
                    except asyncio.QueueFull:
                        pass
        except ValueError:
            pass
        except Exception:
            pass

    @property
    def is_bluetooth(self):
        return self._is_bluetooth

    @property
    def is_connected(self):
        return self.is_running and self.ser is not None and self.ser.is_open
