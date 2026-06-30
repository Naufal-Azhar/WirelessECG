from fastapi import APIRouter

router = APIRouter(prefix="/api/ports", tags=["devices"])

# This will be set by main.py to reference the bluetooth_manager
bluetooth_manager = None


@router.get("")
async def list_ports():
    """List available serial/Bluetooth ports."""
    if bluetooth_manager is None:
        return {"ports": []}
    ports = bluetooth_manager.list_ports()
    return {"ports": ports}
