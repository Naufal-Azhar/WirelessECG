import asyncio
import json
from datetime import datetime

from fastapi import WebSocket


class WebSocketManager:
    """Manages WebSocket connections and broadcasts ECG data to all connected clients."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self._ecg_batch = {"ch1": [], "ch2": [], "ch3": []}
        self._batch_lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Send a message to all connected clients."""
        if not self.active_connections:
            return
        data = json.dumps(message)
        disconnected = []
        for ws in self.active_connections:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)

    async def broadcast_status(self, state: str, message: str, is_bluetooth: bool = False):
        await self.broadcast({
            "type": "status",
            "state": state,
            "message": message,
            "is_bluetooth": is_bluetooth,
        })

    async def broadcast_hr(self, bpm: int, status: str):
        await self.broadcast({"type": "hr", "bpm": bpm, "status": status})

    async def broadcast_ai(self, status: str, probability: float, buffering_sec: int, prediction_made: bool = None):
        msg = {
            "type": "ai",
            "status": status,
            "probability": probability,
            "buffering_sec": buffering_sec,
        }
        if prediction_made is not None:
            msg["prediction_made"] = prediction_made
        await self.broadcast(msg)

    async def broadcast_battery(self, level: int):
        await self.broadcast({"type": "battery", "level": level})

    async def broadcast_recording(self, active: bool, duration_sec: int = 0, samples: int = 0):
        await self.broadcast({
            "type": "recording",
            "active": active,
            "duration_sec": duration_sec,
            "samples_recorded": samples,
        })

    async def broadcast_perf(self, sps: int, fps: int):
        await self.broadcast({"type": "perf", "sps": sps, "fps": fps})

    def add_ecg_sample(self, ch1: float, ch2: float, ch3: float):
        """Add a sample to the current batch (called from processing loop)."""
        self._ecg_batch["ch1"].append(ch1)
        self._ecg_batch["ch2"].append(ch2)
        self._ecg_batch["ch3"].append(ch3)

    async def flush_ecg_batch(self):
        """Send accumulated ECG batch to all clients. Called by broadcast timer."""
        if not self._ecg_batch["ch1"]:
            return
        batch = {
            "ch1": self._ecg_batch["ch1"][:],
            "ch2": self._ecg_batch["ch2"][:],
            "ch3": self._ecg_batch["ch3"][:],
        }
        self._ecg_batch["ch1"].clear()
        self._ecg_batch["ch2"].clear()
        self._ecg_batch["ch3"].clear()
        await self.broadcast({"type": "ecg", "data": batch})

    @property
    def has_connections(self):
        return len(self.active_connections) > 0
