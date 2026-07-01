import os
import asyncio
import threading
import numpy as np
from collections import deque

from scipy.signal import butter, filtfilt

from .config import (
    AI_SAMPLE_RATE,
    AI_WINDOW_SECONDS,
    AI_UPDATE_INTERVAL_SECONDS,
    AI_INPUT_SHAPE,
    AI_BANDPASS_LOWCUT,
    AI_BANDPASS_HIGHCUT,
    AI_BANDPASS_ORDER,
)


class AIInference:
    """Port of ApneaWorker from desktop main.py. Runs TensorFlow inference
    in a background thread, processes 60-second ECG windows."""

    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model = None
        self.is_model_loaded = False
        self._loop = None

        # AI buffer (Lead_I only, same as desktop)
        self.ai_buffer = deque(maxlen=AI_INPUT_SHAPE * 2)
        self.ai_prediction_made = False
        self.latest_status = "60s"
        self.latest_probability = 0.0
        self.latest_buffering_sec = AI_WINDOW_SECONDS

        # Callbacks (async)
        self.on_prediction = None  # async callback(status, probability, buffering_sec)
        self.on_error = None  # async callback(message)

        # Track if inference is running
        self._inference_running = False

    def load_model(self):
        """Load TensorFlow model. Called once at startup."""
        try:
            import tensorflow as tf

            if os.path.exists(self.model_path):
                self.model = tf.keras.models.load_model(self.model_path)
                self.is_model_loaded = True
                print(f"AI: Model loaded from {self.model_path}")
            else:
                print(f"AI: Model not found at {self.model_path}")
        except Exception as e:
            print(f"AI: Failed to load model: {e}")

    def add_sample(self, lead_i_value: float):
        """Add a Lead_I sample to the AI buffer.
        Port of the AI buffer logic in ECGWindow.on_ecg_data()."""
        self.ai_buffer.append(lead_i_value)

        filled_samples = len(self.ai_buffer)
        self.latest_buffering_sec = max(
            0, AI_WINDOW_SECONDS - (filled_samples // AI_SAMPLE_RATE)
        )

        if filled_samples >= AI_INPUT_SHAPE and not self._inference_running:
            data_segment = list(self.ai_buffer)[:AI_INPUT_SHAPE]

            slide_samples = AI_UPDATE_INTERVAL_SECONDS * AI_SAMPLE_RATE
            if slide_samples < len(self.ai_buffer):
                for _ in range(slide_samples):
                    try:
                        self.ai_buffer.popleft()
                    except IndexError:
                        break
            else:
                self.ai_buffer.clear()

            self._inference_running = True
            thread = threading.Thread(
                target=self._run_inference, args=(data_segment,), daemon=True
            )
            thread.start()

    def _run_inference(self, data_segment: list):
        """Run AI inference in background thread.
        Port of ApneaWorker.run() - identical preprocessing logic."""
        try:
            if not self.is_model_loaded:
                self.load_model()
                if not self.is_model_loaded:
                    self._inference_running = False
                    return

            data = np.array(data_segment)

            # Preprocessing: Bandpass + Z-Score (same as desktop)
            def butter_bandpass_filter(sig, lowcut, highcut, fs, order=4):
                nyquist = 0.5 * fs
                low = lowcut / nyquist
                high = highcut / nyquist
                b, a = butter(order, [low, high], btype="band")
                return filtfilt(b, a, sig)

            filtered = butter_bandpass_filter(
                data, AI_BANDPASS_LOWCUT, AI_BANDPASS_HIGHCUT, AI_SAMPLE_RATE
            )

            mean = np.mean(filtered)
            std = np.std(filtered)
            if std < 1e-6:
                normalized = filtered - mean
            else:
                normalized = (filtered - mean) / std

            input_data = normalized.reshape(1, AI_INPUT_SHAPE, 1).astype(np.float32)

            # Prediction
            probability = float(self.model.predict(input_data, verbose=0)[0][0])
            status = "APNEA" if probability >= 0.5 else "NORMAL"

            self.ai_prediction_made = True
            self.latest_status = status
            self.latest_probability = probability
            self.latest_buffering_sec = AI_WINDOW_SECONDS

            if self._loop and self.on_prediction:
                asyncio.run_coroutine_threadsafe(
                    self.on_prediction(status, probability, self.latest_buffering_sec),
                    self._loop,
                )

        except Exception as e:
            if self._loop and self.on_error:
                asyncio.run_coroutine_threadsafe(
                    self.on_error(f"Prediction Error: {e}"), self._loop
                )
        finally:
            self._inference_running = False

    def set_event_loop(self, loop):
        self._loop = loop

    def reset(self):
        """Reset AI state to initial values.
        Called on new serial connection to clear stale predictions from previous session.
        Port of ai_prediction_made = False in desktop ECGWindow.start_connection()."""
        self.ai_buffer.clear()
        self.ai_prediction_made = False
        self.latest_status = f"{AI_WINDOW_SECONDS}s"
        self.latest_probability = 0.0
        self.latest_buffering_sec = AI_WINDOW_SECONDS
        self._inference_running = False

    def get_state(self):
        """Return current AI state for WebSocket broadcasting."""
        return {
            "status": self.latest_status if self.ai_prediction_made else "60s",
            "probability": self.latest_probability,
            "buffering_sec": self.latest_buffering_sec,
            "prediction_made": self.ai_prediction_made,
        }
