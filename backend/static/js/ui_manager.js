/**
 * UI Manager - Handles all DOM updates, replicating the desktop PyQt6 GUI.
 * Port of ECGWindow UI update methods.
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
        this.recordingStartTime = null;
        this.recordingTimerInterval = null;
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
        this.batteryFill.style.width = (pct * 0.68) + '%'; // Scale to fit body

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

        // Port of cardiac status color logic from update_display_sweep()
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
            default:
                this.csDisplay.style.color = '#7f8c8d';
        }
        this.csDisplay.textContent = status;
    }

    // ===== AI PREDICTION =====
    updateAI(status, probability, bufferingSec) {
        // Port of update_ai_ui() + update_rate_indicators() AI display logic
        if (status === 'APNEA') {
            this.aiStatusDisplay.textContent = 'APNEA';
            this.aiStatusDisplay.style.color = '#e74c3c';
            this.aiStatusDisplay.style.fontSize = '11px';
            this.aiProbDisplay.textContent = `Prob: ${(probability * 100).toFixed(1)}%`;
        } else if (status === 'NORMAL') {
            this.aiStatusDisplay.textContent = 'NORMAL';
            this.aiStatusDisplay.style.color = '#27ae60';
            this.aiStatusDisplay.style.fontSize = '11px';
            this.aiProbDisplay.textContent = `Prob: ${(probability * 100).toFixed(1)}%`;
        } else if (status === 'Error') {
            this.aiStatusDisplay.textContent = 'Error';
            this.aiStatusDisplay.style.color = '#c0392b';
        } else {
            // Buffering countdown (60s, 59s, ...)
            this.aiStatusDisplay.textContent = bufferingSec + 's';
            this.aiStatusDisplay.style.color = '#7f8c8d';
            this.aiStatusDisplay.style.fontSize = '14px';
            this.aiProbDisplay.textContent = 'Buffering...';
        }
    }

    // ===== CONNECTION STATUS =====
    updateConnectionStatus(message) {
        this.connectionStatus.textContent = 'Status: ' + message;

        if (message.includes('Connected:')) {
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;
            this.deviceCombo.disabled = true;
            this.refreshBtn.disabled = true;
            this.setBluetoothConnected(true);
        } else {
            this.connectBtn.disabled = false;
            this.disconnectBtn.disabled = true;
            this.deviceCombo.disabled = false;
            this.refreshBtn.disabled = false;
            this.setBluetoothConnected(false);
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
        this.patientDobInput.value = new Date().toISOString().split('T')[0];
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
        this.patientInfo.textContent = 'No Patient Data';
    }

    setPatientInfo(name, dob) {
        this.patientInfo.innerHTML =
            `<span style="color: #2ecc71; font-weight: bold; font-size: 12pt;">` +
            `Pasien: ${name}  |  Tanggal Lahir: ${dob}</span>`;
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
