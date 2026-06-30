import os
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from ..config import REPORTS_DIR

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("")
async def list_reports():
    """List all report sessions."""
    if not REPORTS_DIR.exists():
        return {"reports": []}

    reports = []
    for folder in sorted(REPORTS_DIR.iterdir(), reverse=True):
        if folder.is_dir():
            files = [f.name for f in folder.iterdir() if f.is_file()]
            if files:
                reports.append({
                    "id": folder.name,
                    "files": files,
                    "created": folder.stat().st_mtime,
                })
    return {"reports": reports}


@router.get("/{session_id}/download/{filename}")
async def download_file(session_id: str, filename: str):
    """Download a report file."""
    file_path = REPORTS_DIR / session_id / filename
    if not file_path.exists() or not file_path.is_file():
        return {"error": "File not found"}

    # Determine media type
    if filename.endswith(".docx"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif filename.endswith(".csv"):
        media_type = "text/csv"
    else:
        media_type = "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type,
    )
