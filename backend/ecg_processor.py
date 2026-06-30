import numpy as np
from collections import deque
from scipy.signal import find_peaks, butter, lfilter, lfilter_zi

from .config import (
    SAMPLE_RATE_HZ,
    BANDPASS_LOWCUT,
    BANDPASS_HIGHCUT,
    BANDPASS_ORDER,
    HR_BUFFER_SECONDS,
    HR_MIN_PEAK_DISTANCE_SEC,
    HR_PEAK_HEIGHT_RATIO,
    HR_MIN_SIGNAL_AMPLITUDE,
    LEAD_OFF_THRESHOLD,
)


class ECGProcessor:
    """Port of ECGProcessor + filter logic from desktop main.py.
    Handles bandpass filtering (stateful lfilter) and R-peak heart rate detection."""

    def __init__(self, sample_rate: int = SAMPLE_RATE_HZ):
        self.sample_rate = sample_rate
        self.buffer_size = HR_BUFFER_SECONDS * self.sample_rate
        self.ecg_buffer = deque(maxlen=self.buffer_size)
        self.heart_rate = 0
        self.cardiac_status = "---"
        self.last_peaks = []

        # Filter coefficients
        self.b = None
        self.a = None
        # Filter states for 3 channels
        self.z1 = None
        self.z2 = None
        self.z3 = None

        self._create_filter()

    def _create_filter(self):
        """Port of ECGWindow._create_filter - identical logic."""
        lowcut = BANDPASS_LOWCUT
        highcut = BANDPASS_HIGHCUT
        order = BANDPASS_ORDER

        nyq = 0.5 * self.sample_rate
        low = lowcut / nyq
        high = highcut / nyq

        low = max(0.01, low)
        high = min(high, 0.99)

        if low >= high:
            low = high - 0.01

        try:
            self.b, self.a = butter(order, [low, high], btype="band")
            self.z1 = lfilter_zi(self.b, self.a) * 0
            self.z2 = lfilter_zi(self.b, self.a) * 0
            self.z3 = lfilter_zi(self.b, self.a) * 0
        except Exception:
            self.b, self.a = np.array([1.0]), np.array([1.0])
            self.z1, self.z2, self.z3 = (
                np.array([0.0]),
                np.array([0.0]),
                np.array([0.0]),
            )

    def reset_filter_state(self):
        """Reset filter states (called on lead-off)."""
        self.z1 = lfilter_zi(self.b, self.a) * 0
        self.z2 = lfilter_zi(self.b, self.a) * 0
        self.z3 = lfilter_zi(self.b, self.a) * 0

    def process_sample(self, lead_i: int, ch1_la: int, ch2_ra: int):
        """Process a single ECG sample through the bandpass filter.
        Returns (filtered_ch1, filtered_ch2, filtered_ch3, is_lead_off).

        Port of the filter logic in ECGWindow.on_ecg_data().
        """
        is_lead_off = (
            abs(lead_i) > LEAD_OFF_THRESHOLD
            or abs(ch1_la) > LEAD_OFF_THRESHOLD
            or abs(ch2_ra) > LEAD_OFF_THRESHOLD
        )

        if is_lead_off:
            self.reset_filter_state()
            self.set_lead_off_status()
            return 0.0, 0.0, 0.0, True

        try:
            f1, self.z1 = lfilter(self.b, self.a, [lead_i], zi=self.z1)
            f2, self.z2 = lfilter(self.b, self.a, [ch1_la], zi=self.z2)
            f3, self.z3 = lfilter(self.b, self.a, [ch2_ra], zi=self.z3)

            filtered_1 = float(f1[0])
            filtered_2 = float(f2[0])
            filtered_3 = float(f3[0])
        except Exception:
            filtered_1, filtered_2, filtered_3 = 0.0, 0.0, 0.0

        self.add_data(filtered_1)

        return filtered_1, filtered_2, filtered_3, False

    def add_data(self, ecg_value: float):
        """Add filtered ECG value to HR buffer. Port of ECGProcessor.add_data()."""
        if ecg_value == 0:
            self.ecg_buffer.clear()
            return

        self.ecg_buffer.append(ecg_value)

        if len(self.ecg_buffer) > (self.sample_rate * 2):
            self._calculate_heart_rate()

    def set_lead_off_status(self):
        """Set status when leads are disconnected."""
        self.heart_rate = 0
        self.cardiac_status = "LEAD OFF"
        self.last_peaks = []
        self.ecg_buffer.clear()

    def _calculate_heart_rate(self):
        """Port of ECGProcessor.calculate_heart_rate() - identical logic."""
        if len(self.ecg_buffer) < (self.sample_rate * 2):
            self.heart_rate = 0
            self.cardiac_status = "Detecting..."
            return

        data = np.array(list(self.ecg_buffer))
        min_distance = int(self.sample_rate * HR_MIN_PEAK_DISTANCE_SEC)
        max_height = np.max(data)

        if max_height < HR_MIN_SIGNAL_AMPLITUDE:
            self.heart_rate = 0
            self.cardiac_status = "Flat/Noise"
            self.last_peaks = []
            return

        dynamic_threshold = max_height * HR_PEAK_HEIGHT_RATIO
        peaks, _ = find_peaks(data, height=dynamic_threshold, distance=min_distance)
        self.last_peaks = peaks

        if len(peaks) > 1:
            intervals_samples = np.diff(peaks)
            avg_interval_samples = np.mean(intervals_samples)

            if avg_interval_samples > 0:
                self.heart_rate = int(60 * self.sample_rate / avg_interval_samples)

                if 60 <= self.heart_rate <= 100:
                    self.cardiac_status = "Normal"
                elif self.heart_rate < 60:
                    self.cardiac_status = "Bradycardia"
                else:
                    self.cardiac_status = "Tachycardia"
        else:
            self.heart_rate = 0
            self.cardiac_status = "Detecting..."
