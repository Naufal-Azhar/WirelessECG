import asyncio
import json
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import (
    BASE_DIR, RESOURCE_DIR, REPORTS_DIR, MODELS_DIR, STATIC_DIR,
    MODEL_FILENAME, SAMPLE_RATE_HZ, BATCH_INTERVAL_MS, BATTERY_UPDATE_INTERVAL_MS,
)
from .bluetooth_manager import BluetoothManager
from .ecg_processor import ECGProcessor
from .ai_inference import AIInference
from .websocket_manager import WebSocketManager
from .recording_manager import RecordingManager
from .api import devices, recording, reports

# =============================================================================
# APP SETUP
# =============================================================================
app = FastAPI(title="ECG Wireless Monitoring System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
RESOURCE_DIR.mkdir(exist_ok=True)
REPORTS_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

# =============================================================================
# MODULES
# =============================================================================
bluetooth = BluetoothManager()
ecg_proc = ECGProcessor(sample_rate=SAMPLE_RATE_HZ)
ai_engine = AIInference(str(MODELS_DIR / MODEL_FILENAME))
ws_manager = WebSocketManager()
rec_manager = RecordingManager()

# Wire up API modules
devices.bluetooth_manager = bluetooth
recording.recording_manager = rec_manager

app.include_router(devices.router)
app.include_router(recording.router)
app.include_router(reports.router)

# =============================================================================
# STATE
# =============================================================================
state = {
    "is_connected": False,
    "is_recording": False,
    "is_display_paused": False,
    "latest_battery": 0,
    "incoming_sample_count": 0,
}

# =============================================================================
# DATA PROCESSING LOOP
# =============================================================================
async def process_ecg_data():
    """Main data processing loop. Runs continuously, reads from bluetooth queue,
    processes through filter + HR, feeds AI, adds to recording, sends to WebSocket.

    This is the port of ECGWindow.on_ecg_data() logic."""
    loop = asyncio.get_event_loop()
    ai_engine.set_event_loop(loop)

    while True:
        try:
            # Small yield to prevent blocking
            await asyncio.sleep(0.001)

            if bluetooth.data_queue.empty():
                continue

            data = bluetooth.data_queue.get_nowait()

            # Battery
            if "BATT" in data:
                state["latest_battery"] = data["BATT"]

            if "Lead_I" not in data:
                continue

            state["incoming_sample_count"] += 1

            if state.get("is_display_paused"):
                continue

            lead_i = data.get("Lead_I", 0)
            ch1_la = data.get("CH1_LA", 0)
            ch2_ra = data.get("CH2_RA", 0)

            # AI buffer (Lead_I only)
            ai_engine.add_sample(float(lead_i))

            # Filter + HR
            f1, f2, f3, is_lead_off = ecg_proc.process_sample(lead_i, ch1_la, ch2_ra)

            # Recording
            if rec_manager.is_recording:
                rec_manager.add_sample(lead_i, ch1_la, ch2_ra, f1, f2, f3)
                rec_manager.update_vitals(ecg_proc.heart_rate, ecg_proc.cardiac_status)

            # Add to WebSocket batch
            ws_manager.add_ecg_sample(f1, f2, f3)

        except asyncio.QueueEmpty:
            continue
        except Exception as e:
            print(f"Process error: {e}")


async def ecg_broadcast_loop():
    """Broadcasts batched ECG data every 50ms. Port of QTimer(50ms) update_display_sweep."""
    while True:
        await asyncio.sleep(BATCH_INTERVAL_MS / 1000.0)
        if ws_manager.has_connections:
            await ws_manager.flush_ecg_batch()


async def status_broadcast_loop():
    """Broadcasts HR, AI status, battery, recording status periodically."""
    last_hr = None
    last_ai = None
    last_battery = None
    last_recording = None

    while True:
        await asyncio.sleep(1.0)

        if not ws_manager.has_connections:
            continue

        # HR
        hr_data = (ecg_proc.heart_rate, ecg_proc.cardiac_status)
        if hr_data != last_hr:
            await ws_manager.broadcast_hr(hr_data[0], hr_data[1])
            last_hr = hr_data

        # AI
        ai_state = ai_engine.get_state()
        ai_key = (ai_state["status"], round(ai_state["probability"], 2), ai_state["buffering_sec"])
        if ai_key != last_ai:
            await ws_manager.broadcast_ai(
                ai_state["status"], ai_state["probability"], ai_state["buffering_sec"]
            )
            last_ai = ai_key

        # Battery
        if state["latest_battery"] != last_battery:
            await ws_manager.broadcast_battery(state["latest_battery"])
            last_battery = state["latest_battery"]

        # Recording
        rec_data = (rec_manager.is_recording, rec_manager.get_duration_seconds(), len(rec_manager.recorded_raw))
        if rec_data != last_recording:
            await ws_manager.broadcast_recording(rec_data[0], rec_data[1], rec_data[2])
            last_recording = rec_data

        # Performance counters
        await ws_manager.broadcast_perf(state["incoming_sample_count"], 0)
        state["incoming_sample_count"] = 0


# =============================================================================
# LIFESPAN
# =============================================================================
@app.on_event("startup")
async def startup():
    # Load AI model in background
    asyncio.get_event_loop().run_in_executor(None, ai_engine.load_model)

    # Set status callback
    async def on_status_change(message: str):
        is_bt = bluetooth.is_bluetooth if bluetooth else False
        state_str = "connected" if "Connected:" in message else "disconnected"
        state["is_connected"] = state_str == "connected"
        await ws_manager.broadcast_status(state_str, message, is_bt)

    bluetooth.on_status_change = on_status_change

    # Start background tasks
    asyncio.create_task(process_ecg_data())
    asyncio.create_task(ecg_broadcast_loop())
    asyncio.create_task(status_broadcast_loop())


@app.on_event("shutdown")
async def shutdown():
    await bluetooth.disconnect()


# =============================================================================
# WEBSOCKET ENDPOINT
# =============================================================================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            data = json.loads(msg)
            msg_type = data.get("type")

            if msg_type == "connect":
                port = data.get("port")
                baudrate = data.get("baudrate", 115200)
                if port:
                    await bluetooth.connect(port, baudrate)

            elif msg_type == "disconnect":
                await bluetooth.disconnect()

            elif msg_type == "start_recording":
                patient = data.get("patient", {})
                rec_manager.start_recording(
                    patient.get("name", "Tanpa Nama"),
                    patient.get("dob", "-"),
                )
                state["is_recording"] = True

            elif msg_type == "stop_recording":
                if rec_manager.is_recording:
                    result = rec_manager.stop_recording()
                    state["is_recording"] = False
                    await ws_manager.broadcast({
                        "type": "report_saved",
                        "result": result,
                    })

            elif msg_type == "pause_display":
                state["is_display_paused"] = True

            elif msg_type == "resume_display":
                state["is_display_paused"] = False

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# =============================================================================
# REST ENDPOINTS
# =============================================================================
@app.get("/api/status")
async def get_status():
    return {
        "connected": state["is_connected"],
        "recording": rec_manager.is_recording,
        "battery": state["latest_battery"],
        "hr": ecg_proc.heart_rate,
        "cardiac_status": ecg_proc.cardiac_status,
        "patient_name": rec_manager.patient_name,
    }


# =============================================================================
# STATIC FILES (Frontend)
# =============================================================================
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
