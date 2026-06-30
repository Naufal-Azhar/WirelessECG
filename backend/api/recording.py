from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/recording", tags=["recording"])

recording_manager = None


class StartRecordingRequest(BaseModel):
    patient_name: str
    patient_dob: str


@router.post("/start")
async def start_recording(req: StartRecordingRequest):
    if recording_manager is None:
        return {"error": "Recording manager not available"}
    recording_manager.start_recording(req.patient_name, req.patient_dob)
    return {"status": "recording_started", "patient": req.patient_name}


@router.post("/stop")
async def stop_recording():
    if recording_manager is None:
        return {"error": "Recording manager not available"}
    if not recording_manager.is_recording:
        return {"error": "Not recording"}
    result = recording_manager.stop_recording()
    return result


@router.get("/status")
async def recording_status():
    if recording_manager is None:
        return {"active": False}
    return {
        "active": recording_manager.is_recording,
        "duration_sec": recording_manager.get_duration_seconds(),
        "samples_recorded": len(recording_manager.recorded_raw),
        "patient_name": recording_manager.patient_name,
    }
