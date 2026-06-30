from pathlib import Path

# =============================================================================
# PATHS
# =============================================================================
BASE_DIR = Path(__file__).resolve().parent.parent
RESOURCE_DIR = BASE_DIR / "resources"
REPORTS_DIR = BASE_DIR / "reports"
MODELS_DIR = BASE_DIR / "models"
STATIC_DIR = Path(__file__).resolve().parent / "static"

# =============================================================================
# AI CONFIGURATION
# =============================================================================
MODEL_FILENAME = "best_apnea_model_clean_60s.keras"
AI_SAMPLE_RATE = 100
AI_WINDOW_SECONDS = 60
AI_UPDATE_INTERVAL_SECONDS = 60
AI_INPUT_SHAPE = AI_SAMPLE_RATE * AI_WINDOW_SECONDS  # 6000

# =============================================================================
# ECG / FILTER CONFIGURATION
# =============================================================================
SAMPLE_RATE_HZ = 100

# Bandpass filter for display + HR calculation
BANDPASS_LOWCUT = 0.5
BANDPASS_HIGHCUT = 30.0
BANDPASS_ORDER = 3

# Bandpass filter for AI preprocessing
AI_BANDPASS_LOWCUT = 0.5
AI_BANDPASS_HIGHCUT = 40.0
AI_BANDPASS_ORDER = 4

# Lead-off detection threshold
LEAD_OFF_THRESHOLD = 8000000

# Heart rate detection
HR_BUFFER_SECONDS = 5
HR_MIN_PEAK_DISTANCE_SEC = 0.4
HR_PEAK_HEIGHT_RATIO = 0.5
HR_MIN_SIGNAL_AMPLITUDE = 50

# =============================================================================
# PLOT / DISPLAY CONFIGURATION
# =============================================================================
PLOT_BUFFER_SIZE = 300
PLOT_BLANK_WIDTH = 2
BATCH_INTERVAL_MS = 50  # WebSocket broadcast interval

# =============================================================================
# SERIAL CONFIGURATION
# =============================================================================
DEFAULT_BAUDRATE = 115200
SERIAL_TIMEOUT = 1

# =============================================================================
# BATTERY CONFIGURATION
# =============================================================================
BATTERY_UPDATE_INTERVAL_MS = 10000

# =============================================================================
# SERVER CONFIGURATION
# =============================================================================
SERVER_HOST = "0.0.0.0"
SERVER_PORT = 8000
