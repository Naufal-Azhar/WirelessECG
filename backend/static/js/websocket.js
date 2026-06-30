/**
 * WebSocket Client - Handles connection to backend server.
 * Auto-reconnects with exponential backoff.
 */

class WSClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 10000;
        this.handlers = {};
        this._url = null;
    }

    connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this._url = `${protocol}//${location.host}/ws`;
        this._doConnect();
    }

    _doConnect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.ws = new WebSocket(this._url);

        this.ws.onopen = () => {
            this.isConnected = true;
            this.reconnectDelay = 1000;
            this._emit('connected');
        };

        this.ws.onclose = () => {
            this.isConnected = false;
            this._emit('disconnected');
            this._scheduleReconnect();
        };

        this.ws.onerror = () => {
            this.isConnected = false;
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this._emit(msg.type, msg);
            } catch (e) {
                // ignore parse errors
            }
        };
    }

    _scheduleReconnect() {
        setTimeout(() => {
            this._doConnect();
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
        }, this.reconnectDelay);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    on(event, callback) {
        if (!this.handlers[event]) this.handlers[event] = [];
        this.handlers[event].push(callback);
    }

    _emit(event, data) {
        const handlers = this.handlers[event];
        if (handlers) {
            for (const cb of handlers) {
                try { cb(data); } catch (e) { console.error('WS handler error:', e); }
            }
        }
    }

    // Command helpers
    connectDevice(port, baudrate = 115200) {
        this.send({ type: 'connect', port, baudrate });
    }

    disconnectDevice() {
        this.send({ type: 'disconnect' });
    }

    startRecording(patientName, patientDob) {
        this.send({
            type: 'start_recording',
            patient: { name: patientName, dob: patientDob }
        });
    }

    stopRecording() {
        this.send({ type: 'stop_recording' });
    }

    pauseDisplay() {
        this.send({ type: 'pause_display' });
    }

    resumeDisplay() {
        this.send({ type: 'resume_display' });
    }
}
