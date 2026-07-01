/**
 * App - Main application entry point.
 * Initializes all modules and wires up events.
 * Port of ECGWindow.__init__() + init_ui() + all event handlers.
 */

// ===== INITIALIZE MODULES =====
const ws = new WSClient();
const ecgDisplay = new ECGDisplay();
const ui = new UIManager();

// Expose for debugging / testing
window.__ecg = { ws, ecgDisplay, ui };

// ===== WEBSOCKET EVENT HANDLERS =====

ws.on('ecg', (msg) => {
    ecgDisplay.pushBatch(msg.data);
});

ws.on('hr', (msg) => {
    ui.updateHeartRate(msg.bpm, msg.status);
});

ws.on('ai', (msg) => {
    ui.updateAI(msg.status, msg.probability, msg.buffering_sec, msg.prediction_made);
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
    // Server-authoritative recording state sync.
    // The UI already has a local timer; this is for catching up if the
    // server-side state diverges (e.g. someone hits the REST stop endpoint).
    if (!msg.active && ui.isRecording) {
        // Server says we stopped but UI thinks we're still recording
        ui.stopRecordingUI();
    }
});

ws.on('perf', (msg) => {
    ui.updatePerformance(msg.sps);
});

ws.on('report_saved', (msg) => {
    if (msg.result && msg.result.error) {
        ui.showAlert('No Data', msg.result.error);
    } else if (msg.result) {
        const fname = msg.result.files?.report_docx || 'generated';
        const folder = msg.result.folder || '';
        ui.showAlert('Success',
            `Reports saved successfully.\nDocx: ${fname}\nFolder: ${folder}`);
    }
    ui.stopRecordingUI();
});

ws.on('connected', () => {
    // WebSocket connected to server
    refreshPorts();
});

ws.on('disconnected', () => {
    ui.updateConnectionStatus('Server Disconnected');
    ui.setPauseResumeState(false);
    ecgDisplay.resume();
    // Reset all live readouts - we no longer have a data source
    ui.updateHeartRate(0, '---');
    ui.resetAIStopped();
});

// ===== BUTTON EVENT HANDLERS =====

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
    if (ui.isPaused) return;
    ecgDisplay.pause();
    ws.pauseDisplay();
    ui.setPauseResumeState(true);
});

// Resume
ui.resumeBtn.addEventListener('click', () => {
    if (!ui.isPaused) return;
    ecgDisplay.resume();
    ws.resumeDisplay();
    ui.setPauseResumeState(false);
});

// Recording Time / Stop Recording
ui.recordingBtn.addEventListener('click', () => {
    if (!ui.isRecording) {
        ui.showPatientModal();
    } else {
        ws.stopRecording();
    }
});

// Patient Modal - Start Recording
ui.modalStartBtn.addEventListener('click', () => {
    const name = ui.patientNameInput.value.trim() || 'Tanpa Nama';
    const dobRaw = ui.patientDobInput.value;
    // Convert YYYY-MM-DD to DD/MM/YYYY for display (matches desktop)
    const dobFormatted = dobRaw
        ? dobRaw.split('-').reverse().join('/')
        : '-';

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

// Close button
ui.closeBtn.addEventListener('click', () => {
    ws.disconnectDevice();
    setTimeout(() => {
        try { window.close(); } catch (e) { /* ignore */ }
    }, 200);
});

// Close modals on overlay click
ui.patientModal.addEventListener('click', (e) => {
    if (e.target === ui.patientModal) ui.hidePatientModal();
});
ui.alertModal.addEventListener('click', (e) => {
    if (e.target === ui.alertModal) ui.hideAlert();
});

// Close modals with Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (ui.alertModal.style.display === 'flex') ui.hideAlert();
        else if (ui.patientModal.style.display === 'flex') ui.hidePatientModal();
    }
});

// ===== ANIMATION LOOP =====
function renderLoop() {
    ecgDisplay.render();
    requestAnimationFrame(renderLoop);
}

// ===== PERFORMANCE COUNTERS =====
setInterval(() => {
    const fps = ecgDisplay.fps;
    ui.updateFPS(fps);
}, 1000);

// Date update - match desktop: every 1 second (the QTimer(1000ms) on update_rate_indicators)
setInterval(() => ui.updateDate(), 1000);

// ===== STARTUP =====
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
