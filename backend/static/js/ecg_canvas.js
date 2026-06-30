/**
 * ECG Canvas Renderer - Port of pyqtgraph sweep display from desktop main.py.
 * Renders 3-lead ECG on HTML5 Canvas with circular buffer and NaN blanking.
 */

class ECGCanvas {
    constructor(canvasId, color, label) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.color = color;
        this.label = label;

        // Same config as desktop
        this.bufferSize = 300;
        this.blankWidth = 2;
        this.writePointer = 0;

        // Circular buffer (NaN = blank)
        this.data = new Float32Array(this.bufferSize);
        this.data.fill(NaN);

        // Y-axis scaling
        this.minY = -100;
        this.maxY = 100;
        this.didWrap = false;

        // Resize handling
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
    }

    /**
     * Push batch of samples into the circular buffer.
     * Port of update_display_sweep() data insertion logic.
     */
    pushSamples(samples) {
        for (let s = 0; s < samples.length; s++) {
            const val = samples[s];
            this.data[this.writePointer] = val;

            // Blank zone ahead of pointer (same as desktop)
            for (let i = 1; i <= this.blankWidth; i++) {
                const blankIdx = (this.writePointer + i) % this.bufferSize;
                this.data[blankIdx] = NaN;
            }

            this.writePointer++;
            if (this.writePointer >= this.bufferSize) {
                this.writePointer = 0;
                this.didWrap = true;
            }
        }
    }

    /**
     * Render the ECG sweep line on canvas.
     * Port of update_display_sweep() drawing logic.
     */
    render() {
        const ctx = this.ctx;
        const w = this.displayWidth;
        const h = this.displayHeight;

        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const yRange = this.maxY - this.minY;
        if (yRange === 0) return;

        let isDrawing = false;

        for (let i = 0; i < this.bufferSize; i++) {
            const val = this.data[i];

            if (isNaN(val)) {
                // Break the line at NaN (blank zone)
                if (isDrawing) {
                    ctx.stroke();
                    ctx.beginPath();
                    isDrawing = false;
                }
                continue;
            }

            const x = (i / (this.bufferSize - 1)) * w;
            const y = h - ((val - this.minY) / yRange) * h;

            if (!isDrawing) {
                ctx.moveTo(x, y);
                isDrawing = true;
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }

    /**
     * Auto-scale Y axis based on current buffer data.
     * Port of set_manual_range() from desktop.
     */
    autoScaleY() {
        let minVal = Infinity;
        let maxVal = -Infinity;
        let hasData = false;

        for (let i = 0; i < this.bufferSize; i++) {
            const v = this.data[i];
            if (!isNaN(v)) {
                if (v < minVal) minVal = v;
                if (v > maxVal) maxVal = v;
                hasData = true;
            }
        }

        if (!hasData) {
            this.minY = -100;
            this.maxY = 100;
            return;
        }

        const range = maxVal - minVal;
        const padding = range < 50 ? 25 : range * 0.1;
        this.minY = minVal - padding;
        this.maxY = maxVal + padding;
    }
}

/**
 * ECG Display Manager - Manages 3 ECG canvases.
 * Provides the same interface as the desktop's 3-plot system.
 */
class ECGDisplay {
    constructor() {
        this.lead1 = new ECGCanvas('ecgCanvas1', '#e74c3c', 'Lead I');
        this.lead2 = new ECGCanvas('ecgCanvas2', '#3498db', 'Lead II');
        this.lead3 = new ECGCanvas('ecgCanvas3', '#27ae60', 'Lead III');
        this.frameCount = 0;
        this.isPaused = false;
    }

    /**
     * Push ECG data batch from WebSocket.
     * @param {Object} data - {ch1: [...], ch2: [...], ch3: [...]}
     */
    pushBatch(data) {
        if (this.isPaused) return;

        const ch1 = data.ch1 || [];
        const ch2 = data.ch2 || [];
        const ch3 = data.ch3 || [];

        this.lead1.pushSamples(ch1);
        this.lead2.pushSamples(ch2);
        this.lead3.pushSamples(ch3);
    }

    /**
     * Render all canvases. Called by requestAnimationFrame.
     */
    render() {
        // Auto-scale on wrap-around (same as desktop)
        if (this.lead1.didWrap) {
            this.lead1.autoScaleY();
            this.lead1.didWrap = false;
        }
        if (this.lead2.didWrap) {
            this.lead2.autoScaleY();
            this.lead2.didWrap = false;
        }
        if (this.lead3.didWrap) {
            this.lead3.autoScaleY();
            this.lead3.didWrap = false;
        }

        this.lead1.render();
        this.lead2.render();
        this.lead3.render();
        this.frameCount++;
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }

    get fps() {
        const f = this.frameCount;
        this.frameCount = 0;
        return f;
    }
}
