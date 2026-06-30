/**
 * App - Main application entry point.
 * Initializes all modules and wires up events.
 * Port of ECGWindow.__init__() + init_ui() + all event handlers.
 */

// ===== INITIALIZE MODULES =====
const ws = new WSClient();
const ecgDisplay = new ECGDisplay();
const ui = new UIManager();

// ===== WEBSOCKET EVENT HANDLERS =====
// Port of ECGWindow.on_ecg_data() display update logic

ws.on('ecg', (msg) => {
    ecgDisplay.pushBatch(msg.data);
});

ws.on('hr', (msg) => {
    ui.updateHeartRate(msg.bpm, msg.status);
});

ws.on('ai', (msg) => {
    ui.updateAI(msg.status, msg.probability, msg.buffering_sec);
});

ws.on('battery', (msg) => {
    ui.updateBattery(msg.level);
});

ws.on('status', (msg) => {
    ui.updateConnectionStatus(msg.message);
    if (msg.is_bluetooth) {
        ui.setBluetoothConnected(msg.state === 'connected');
    }
});

ws.on('recording', (msg) => {
    // Recording status updates from server
});

ws.on('perf', (msg) => {
    ui.updatePerformance(msg.sps);
});

ws.on('report_saved', (msg) => {
    if (msg.result && msg.result.error) {
        ui.showAlert('Error', msg.result.error);
    } else if (msg.result) {
        ui.showAlert('Success', `Reports saved successfully.\nDocx: ${msg.result.files?.report_docx || 'generated'}`);
    }
    ui.stopRecordingUI();
});

ws.on('connected', () => {
    // WebSocket connected to server
    refreshPorts();
});

ws.on('disconnected', () => {
    ui.updateConnectionStatus('Server Disconnected');
});

// ===== BUTTON EVENT HANDLERS =====
// Port of ECGWindow button connections

// Refresh ports
ui.refreshBtn.addEventListener('click', () => refreshPorts());

function refreshPorts() {
    fetch('/api/ports')
        .then(r => r.json())
        .then(data => ui.populatePorts(data.ports))
        .catch(() => ui.populatePorts([]));
}

// Connect
ui.connectBtn.addEventListener('click', () => {
    const port = ui.deviceCombo.value;
    if (!port || port === 'No devices found') return;
    ws.connectDevice(port);
});

// Disconnect
ui.disconnectBtn.addEventListener('click', () => {
    ws.disconnectDevice();
});

// Pause
ui.pauseBtn.addEventListener('click', () => {
    ecgDisplay.pause();
    ws.pauseDisplay();
});

// Resume
ui.resumeBtn.addEventListener('click', () => {
    ecgDisplay.resume();
    ws.resumeDisplay();
});

// Recording Time / Stop Recording
ui.recordingBtn.addEventListener('click', () => {
    if (!ui.isRecording) {
        // Show patient data dialog (port of start_recording_time first branch)
        ui.showPatientModal();
    } else {
        // Stop recording (port of start_recording_time second branch)
        ws.stopRecording();
        // UI will be updated when report_saved message arrives
    }
});

// Patient Modal - Start Recording
ui.modalStartBtn.addEventListener('click', () => {
    const name = ui.patientNameInput.value.trim() || 'Tanpa Nama';
    const dob = ui.patientDobInput.value || '-';
    const dobFormatted = dob; // Already in YYYY-MM-DD from date input

    ui.hidePatientModal();
    ui.setPatientInfo(name, dobFormatted);
    ui.startRecordingUI();
    ws.startRecording(name, dobFormatted);
});

// Patient Modal - Cancel
ui.modalCancelBtn.addEventListener('click', () => {
    ui.hidePatientModal();
});

// Alert Modal - OK
ui.alertOkBtn.addEventListener('click', () => {
    ui.hideAlert();
});

// Close button (disconnect)
ui.closeBtn.addEventListener('click', () => {
    ws.disconnectDevice();
});

// Close modals on overlay click
ui.patientModal.addEventListener('click', (e) => {
    if (e.target === ui.patientModal) ui.hidePatientModal();
});
ui.alertModal.addEventListener('click', (e) => {
    if (e.target === ui.alertModal) ui.hideAlert();
});

// ===== ANIMATION LOOP =====
// Port of QTimer(50ms) update_display_sweep()
function renderLoop() {
    ecgDisplay.render();
    requestAnimationFrame(renderLoop);
}

// ===== PERFORMANCE COUNTERS =====
// Port of sps_calc_timer (1 second interval)
setInterval(() => {
    const fps = ecgDisplay.fps;
    ui.updateFPS(fps);
}, 1000);

// Update date
setInterval(() => ui.updateDate(), 60000);

// ===== STARTUP =====
// Port of ECGWindow.showMaximized() + init
document.addEventListener('DOMContentLoaded', () => {
    ui.updateDate();
    ui.updateBattery(0);

    // Connect WebSocket
    ws.connect();

    // Start render loop
    requestAnimationFrame(renderLoop);

    // Initial port refresh
    setTimeout(refreshPorts, 500);
});
