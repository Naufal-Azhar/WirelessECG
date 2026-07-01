import os
import random
import numpy as np
from datetime import datetime
from pathlib import Path

from .config import REPORTS_DIR, SAMPLE_RATE_HZ


class RecordingManager:
    """Manages ECG recording sessions. Ports the recording logic from desktop ECGWindow."""

    def __init__(self):
        self.is_recording = False
        self.start_time = None
        self.patient_name = "-"
        self.patient_dob = "-"
        self.recorded_raw = []  # List of CSV strings (timestamp,Lead_I,Lead_II,Lead_III)
        self.recorded_processed = []  # List of [timestamp, f1, f2, f3]
        self.ai_results = []  # List of dicts {timestamp, elapsed_sec, status, probability}
        # Latest vitals (used in the generated report)
        self._last_hr = 0
        self._last_cardiac_status = "---"

    def start_recording(self, patient_name: str, patient_dob: str):
        self.is_recording = True
        self.start_time = datetime.now()
        self.patient_name = patient_name or "Tanpa Nama"
        self.patient_dob = patient_dob or "-"
        self.recorded_raw.clear()
        self.recorded_processed.clear()
        self.ai_results.clear()

    def add_sample(self, lead_i: int, ch1_la: int, ch2_ra: int,
                   filtered_1: float, filtered_2: float, filtered_3: float):
        """Add a sample to recording buffers. Port of ECGWindow.on_ecg_data recording logic."""
        if not self.is_recording:
            return
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        self.recorded_raw.append(f"{timestamp},{lead_i},{ch1_la},{ch2_ra}")
        self.recorded_processed.append([timestamp, filtered_1, filtered_2, filtered_3])

    def add_ai_result(self, status: str, probability: float):
        """Add an AI prediction result. Port of ECGWindow.update_ai_ui recording logic."""
        if not self.is_recording or not self.start_time:
            return
        elapsed = datetime.now() - self.start_time
        elapsed_seconds = int(elapsed.total_seconds())
        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.ai_results.append({
            "timestamp": timestamp_str,
            "elapsed_sec": elapsed_seconds,
            "status": status,
            "probability": f"{probability:.4f}",
        })

    def get_duration_seconds(self) -> int:
        if not self.start_time:
            return 0
        return int((datetime.now() - self.start_time).total_seconds())

    def get_duration_str(self) -> str:
        total = self.get_duration_seconds()
        hours, remainder = divmod(total, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    def stop_recording(self) -> dict:
        """Stop recording and generate all report files. Returns file paths."""
        self.is_recording = False
        # Always reset start_time so get_duration_seconds returns 0
        self.start_time = None
        if not self.recorded_raw:
            self.recorded_raw.clear()
            self.recorded_processed.clear()
            self.ai_results.clear()
            return {"error": "No data recorded"}

        safe_name = "".join(c if c.isalnum() else "_" for c in self.patient_name)
        time_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        folder_name = f"{safe_name}_{time_str}"
        folder_path = REPORTS_DIR / folder_name

        try:
            folder_path.mkdir(parents=True, exist_ok=True)
        except Exception:
            folder_path = REPORTS_DIR

        # File paths
        filename_raw = folder_path / f"ECG_RAW_{safe_name}_{time_str}.csv"
        filename_proc = folder_path / f"ECG_PROCESSED_{safe_name}_{time_str}.csv"
        filename_anno = folder_path / f"ECG_AI_ANNOTATION_{safe_name}_{time_str}.csv"
        filename_docx = folder_path / f"ECG_REPORT_{safe_name}_{time_str}.docx"

        # 1. Save RAW CSV
        with open(filename_raw, "w") as f:
            f.write("Timestamp,Lead_I_RAW,Lead_II_RAW,Lead_III_RAW\n")
            f.write("\n".join(self.recorded_raw))

        # 2. Save Processed CSV (Z-Score normalized)
        if self.recorded_processed:
            proc_data = np.array(
                [row[1:] for row in self.recorded_processed], dtype=float
            )
            timestamps = [row[0] for row in self.recorded_processed]
            means = np.mean(proc_data, axis=0)
            stds = np.std(proc_data, axis=0)
            stds[stds == 0] = 1.0
            z_scored = (proc_data - means) / stds

            with open(filename_proc, "w") as f:
                f.write("Timestamp,Lead_I_Norm,Lead_II_Norm,Lead_III_Norm\n")
                for i in range(len(timestamps)):
                    line = (
                        f"{timestamps[i]},{z_scored[i][0]:.4f},"
                        f"{z_scored[i][1]:.4f},{z_scored[i][2]:.4f}\n"
                    )
                    f.write(line)

        # 3. Save AI Annotation CSV
        with open(filename_anno, "w") as f:
            f.write("Timestamp,Elapsed_Seconds,Prediction_Status,Probability\n")
            for item in self.ai_results:
                line = (
                    f"{item['timestamp']},{item['elapsed_sec']},"
                    f"{item['status']},{item['probability']}\n"
                )
                f.write(line)

        # 4. Generate Word Report
        from .report_generator import generate_word_report

        docx_path = folder_path / f"ECG_REPORT_{safe_name}_{time_str}.docx"
        generate_word_report(
            docx_path,
            patient_name=self.patient_name,
            patient_dob=self.patient_dob,
            heart_rate=self._last_hr,
            cardiac_status=self._last_cardiac_status,
            ai_results=self.ai_results,
            recorded_processed=self.recorded_processed,
            sample_rate=SAMPLE_RATE_HZ,
            duration_str=self.get_duration_str(),
            total_raw_samples=len(self.recorded_raw),
        )

        result = {
            "folder": str(folder_path),
            "files": {
                "raw_csv": str(filename_raw.name),
                "processed_csv": str(filename_proc.name),
                "ai_annotation_csv": str(filename_anno.name),
                "report_docx": str(docx_path.name),
            },
            "patient_name": self.patient_name,
            "duration": self.get_duration_str(),
        }

        self.start_time = None
        return result

    def update_vitals(self, hr: int, cardiac_status: str):
        self._last_hr = hr
        self._last_cardiac_status = cardiac_status

    def reset_session(self):
        """Clear all session data without affecting the in-progress recording flag.
        Called on a fresh serial connection (mirrors desktop start_connection
        clearing recorded_data, recorded_processed_data, ai_results_buffer)."""
        self.recorded_raw.clear()
        self.recorded_processed.clear()
        self.ai_results.clear()
        # start_time is only set during an active recording; leave it alone.
        # _last_hr / _last_cardiac_status persist so the report shows last seen values.
