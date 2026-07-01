/**
 * UI Manager - Handles all DOM updates, replicating the desktop PyQt6 GUI.
 * Port of ECGWindow UI update methods.
 *
 * AI display state machine (mirrors desktop update_rate_indicators + update_ai_ui):
 *   not connected + no prediction  -> status="Stopped",    prob="-"
 *   connected + buffering (first)  -> status="Ns" (countdown), prob="Buffering..."
 *   connected + predicted          -> status="APNEA/NORMAL", prob="Prob: X%"
 *   connected + between predicts   -> status="APNEA/NORMAL", prob="Next update: Xs"
 *   error                          -> status="Error",       prob="Prob: -"
 */

class UIManager {
    constructor() {
        // Top bar
        this.dateDisplay = document.getElementById('dateDisplay');
        this.btIcon = document.getElementById('btIcon');
        this.batteryFill = document.getElementById('batteryFill');
        this.batteryText = document.getElementById('batteryText');

        // Info boxes
        this.hrDisplay = document.getElementById('hrDisplay');
        this.csDisplay = document.getElementById('csDisplay');
        this.aiProbDisplay = document.getElementById('aiProbDisplay');
        this.aiStatusDisplay = document.getElementById('aiStatusDisplay');

        // Device
        this.deviceCombo = document.getElementById('deviceCombo');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Control
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resumeBtn = document.getElementById('resumeBtn');
        this.recordingBtn = document.getElementById('recordingBtn');
        this.recordingTime = document.getElementById('recordingTime');
        this.closeBtn = document.getElementById('closeBtn');

        // Patient info
        this.patientInfo = document.getElementById('patientInfo');

        // Performance
        this.spsLabel = document.getElementById('spsLabel');
        this.fpsLabel = document.getElementById('fpsLabel');

        // Modals
        this.patientModal = document.getElementById('patientModal');
        this.patientNameInput = document.getElementById('patientNameInput');
        this.patientDobInput = document.getElementById('patientDobInput');
        this.modalStartBtn = document.getElementById('modalStartBtn');
        this.modalCancelBtn = document.getElementById('modalCancelBtn');

        this.alertModal = document.getElementById('alertModal');
        this.alertTitle = document.getElementById('alertTitle');
        this.alertMessage = document.getElementById('alertMessage');
        this.alertOkBtn = document.getElementById('alertOkBtn');

        // State
        this.isRecording = false;
        this.isPaused = false;
        this.isConnected = false;
        this.recordingStartTime = null;
        this.recordingTimerInterval = null;

        // AI state tracking
        this.aiPredictionMade = false;   // matches desktop ai_prediction_made
        this.aiLastStatus = 'Stopped';   // last status word we displayed (for change detection)
        this.aiLastProbability = 0;

        // Set initial idle display
        this._renderAIStopped();
    }

    // ===== DATE =====
    updateDate() {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        this.dateDisplay.textContent = `${dd}/${mm}/${yyyy}`;
    }

    // ===== BLUETOOTH ICON =====
    setBluetoothConnected(connected) {
        this.btIcon.src = connected ? '/assets/bt_on.svg' : '/assets/bt_off.svg';
    }

    // ===== BATTERY =====
    updateBattery(level) {
        // Port of BatteryIcon.set_level() + paintEvent()
        const pct = Math.max(0, Math.min(100, Math.round(level)));
        this.batteryText.textContent = pct + '%';
        // Body is 60px wide, 2px border on each side, 3px fill padding on each side
        // = (60 - 2*2 - 2*3) = 50px max fill width
        this.batteryFill.style.width = ((pct / 100) * 50) + 'px';

        if (pct > 50) {
            this.batteryFill.style.background = '#2ecc71';
        } else if (pct > 20) {
            this.batteryFill.style.background = '#f1c40f';
        } else {
            this.batteryFill.style.background = '#e74c3c';
        }
    }

    // ===== HEART RATE =====
    updateHeartRate(bpm, status) {
        this.hrDisplay.textContent = bpm > 0 ? `${bpm} BPM` : '-- BPM';
        this.csDisplay.textContent = status;
        this._applyCardiacStatusColor(status);
    }

    _applyCardiacStatusColor(status) {
        // Port of update_display_sweep cardiac status color logic from desktop
        switch (status) {
            case 'Normal':
                this.csDisplay.style.color = '#27ae60';
                break;
            case 'Bradycardia':
                this.csDisplay.style.color = '#f39c12';
                break;
            case 'Tachycardia':
                this.csDisplay.style.color = '#e74c3c';
                break;
            case 'LEAD OFF':
                this.csDisplay.style.color = '#95a5a6';
                break;
            case 'Detecting...':
            case 'Flat/Noise':
                this.csDisplay.style.color = '#7f8c8d';
                break;
            default:
                this.csDisplay.style.color = '#7f8c8d';
        }
    }

    // ===== AI DISPLAY =====
    /**
     * Called on every 'ai' message from the server. Mirrors the desktop split between
     * update_ai_ui (called on prediction) and update_rate_indicators (called every 1s).
     *
     * @param {string} status - 'APNEA' | 'NORMAL' | 'Error' | "Ns" countdown string
     * @param {number} probability - 0..1
     * @param {number} bufferingSec - seconds until next prediction
     * @param {boolean} [predictionMade] - explicit override from server (optional)
     */
    updateAI(status, probability, bufferingSec, predictionMade) {
        // Server explicitly told us we're reset (e.g. on reconnect)
        if (predictionMade === false) {
            this._renderAIBuffering(bufferingSec);
            return;
        }

        if (status === 'APNEA' || status === 'NORMAL') {
            // A prediction was just made
            const newPrediction = !this.aiPredictionMade
                || status !== this.aiLastStatus
                || Math.abs(probability - this.aiLastProbability) > 0.001;

            if (newPrediction) {
                // Show the prediction
                this.aiPredictionMade = true;
                this.aiLastStatus = status;
                this.aiLastProbability = probability;
                this.aiStatusDisplay.textContent = status;
                this.aiStatusDisplay.style.fontSize = '11px';
                this.aiStatusDisplay.style.color = status === 'APNEA' ? '#e74c3c' : '#27ae60';
                this.aiProbDisplay.textContent = `Prob: ${(probability * 100).toFixed(1)}%`;
            } else {
                // Same prediction still showing - update countdown in prob display
                this.aiStatusDisplay.textContent = status;
                this.aiStatusDisplay.style.fontSize = '11px';
                this.aiStatusDisplay.style.color = status === 'APNEA' ? '#e74c3c' : '#27ae60';
                this.aiProbDisplay.textContent = `Next update: ${bufferingSec}s`;
            }
            return;
        }

        if (status === 'Error') {
            this.aiStatusDisplay.textContent = 'Error';
            this.aiStatusDisplay.style.color = '#c0392b';
            this.aiStatusDisplay.style.fontSize = '11px';
            this.aiProbDisplay.textContent = 'Prob: -';
            return;
        }

        // Otherwise: numeric countdown "Ns" = buffering
        this._renderAIBuffering(bufferingSec);
    }

    _renderAIBuffering(bufferingSec) {
        this.aiStatusDisplay.textContent = `${bufferingSec}s`;
        this.aiStatusDisplay.style.color = '#7f8c8d';
        this.aiStatusDisplay.style.fontSize = '14px';
        // If we already had a prediction, show "Next update", otherwise "Buffering..."
        if (this.aiPredictionMade) {
            this.aiProbDisplay.textContent = 'Next update...';
        } else {
            this.aiProbDisplay.textContent = 'Buffering...';
        }
    }

    /** Called when the serial device disconnects. Port of desktop's
     *  update_rate_indicators "not is_recording" branch. */
    _renderAIStopped() {
        this.aiPredictionMade = false;
        this.aiLastStatus = 'Stopped';
        this.aiLastProbability = 0;
        this.aiStatusDisplay.textContent = 'Stopped';
        this.aiStatusDisplay.style.color = '#7f8c8d';
        this.aiStatusDisplay.style.fontSize = '14px';
        this.aiProbDisplay.textContent = '-';
    }

    /** Public API for disconnect handler. */
    resetAIStopped() {
        this._renderAIStopped();
    }

    /** Public API for connect handler. Resets to "60s" + "Buffering..." */
    resetAIBuffering() {
        this.aiPredictionMade = false;
        this.aiLastStatus = '60s';
        this.aiLastProbability = 0;
        this.aiStatusDisplay.textContent = '60s';
        this.aiStatusDisplay.style.color = '#7f8c8d';
        this.aiStatusDisplay.style.fontSize = '14px';
        this.aiProbDisplay.textContent = 'Buffering...';
    }

    // ===== CONNECTION STATUS =====
    updateConnectionStatus(message) {
        this.connectionStatus.textContent = 'Status: ' + message;

        const wasConnected = this.isConnected;
        const nowConnected = message.includes('Connected:');
        this.isConnected = nowConnected;

        if (nowConnected) {
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;
            this.deviceCombo.disabled = true;
            this.refreshBtn.disabled = true;
            this.setBluetoothConnected(true);
            if (!wasConnected) {
                // Fresh connection - reset AI to "60s" + "Buffering..."
                this.resetAIBuffering();
            }
        } else {
            this.connectBtn.disabled = false;
            this.disconnectBtn.disabled = true;
            this.deviceCombo.disabled = false;
            this.refreshBtn.disabled = false;
            this.setBluetoothConnected(false);
            if (wasConnected) {
                // Disconnection - reset AI to "Stopped"
                this._renderAIStopped();
            }
        }
    }

    // ===== DEVICE LIST =====
    populatePorts(ports) {
        this.deviceCombo.innerHTML = '';
        if (!ports || ports.length === 0) {
            this.deviceCombo.innerHTML = '<option>No devices found</option>';
            this.deviceCombo.disabled = true;
            this.connectBtn.disabled = true;
        } else {
            this.deviceCombo.disabled = false;
            this.connectBtn.disabled = false;
            for (const port of ports) {
                const opt = document.createElement('option');
                opt.value = port.device;
                opt.textContent = `${port.description} (${port.device})`;
                opt.dataset.bluetooth = port.is_bluetooth;
                this.deviceCombo.appendChild(opt);
            }
        }
    }

    // ===== RECORDING =====
    showPatientModal() {
        this.patientModal.style.display = 'flex';
        this.patientNameInput.value = '';
        // Default DOB to today (use YYYY-MM-DD for input[type=date])
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        this.patientDobInput.value = `${yyyy}-${mm}-${dd}`;
        this.patientNameInput.focus();
    }

    hidePatientModal() {
        this.patientModal.style.display = 'none';
    }

    startRecordingUI() {
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        this.recordingBtn.textContent = 'Stop Recording & Save Report';
        this.recordingBtn.classList.remove('btn-orange');
        this.recordingBtn.classList.add('btn-red');

        this.recordingTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
            const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            this.recordingTime.textContent = `Recording Time: ${h}:${m}:${s}`;
        }, 1000);
    }

    stopRecordingUI() {
        this.isRecording = false;
        this.recordingStartTime = null;
        if (this.recordingTimerInterval) {
            clearInterval(this.recordingTimerInterval);
            this.recordingTimerInterval = null;
        }
        this.recordingBtn.textContent = 'Recording Time';
        this.recordingBtn.classList.remove('btn-red');
        this.recordingBtn.classList.add('btn-orange');
        this.recordingTime.textContent = 'Recording Time: 00:00:00';
        this.patientInfo.innerHTML = 'No Patient Data';
    }

    setPatientInfo(name, dob) {
        this.patientInfo.innerHTML =
            `<span style="color: #2ecc71; font-weight: bold; font-size: 12pt;">` +
            `Pasien: ${name}  |  Tanggal Lahir: ${dob}</span>`;
    }

    // ===== PAUSE / RESUME =====
    setPauseResumeState(paused) {
        this.isPaused = paused;
        if (paused) {
            this.pauseBtn.classList.add('is-active');
            this.resumeBtn.classList.remove('is-active');
        } else {
            this.pauseBtn.classList.remove('is-active');
            this.resumeBtn.classList.add('is-active');
        }
    }

    // ===== PERFORMANCE =====
    updatePerformance(sps) {
        this.spsLabel.textContent = `Serial: ${sps} SPS`;
    }

    updateFPS(fps) {
        this.fpsLabel.textContent = `Plotter: ${fps} FPS`;
    }

    // ===== ALERTS =====
    showAlert(title, message) {
        this.alertTitle.textContent = title;
        this.alertMessage.textContent = message;
        this.alertModal.style.display = 'flex';
    }

    hideAlert() {
        this.alertModal.style.display = 'none';
    }
}
