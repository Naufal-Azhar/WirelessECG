# Wireless ECG AI Monitoring System (GoSipAPP)

Proyek ini memantau sinyal ECG dari **ESP32 + ADS1293** melalui serial Bluetooth Classic (SPP) atau port serial USB. Ada dua aplikasi **alternatif** untuk PC: antarmuka web (FastAPI + browser) dan aplikasi desktop (PyQt6). Keduanya menampilkan tiga kanal sinyal, menghitung detak jantung, menjalankan model deteksi *sleep apnea*, dan menyimpan hasil perekaman secara lokal. Ini prototipe pemantauan, **bukan alat diagnosis klinis yang tervalidasi**.

## Alur sistem

```text
ESP32 + ADS1293 (100 sampel/detik)
  └─ serial Bluetooth SPP / USB, 115200 baud
      ├─ Web: backend/bluetooth_manager.py → backend/main.py
      │    ├─ filter + estimasi BPM → WebSocket (batch 50 ms) → 3 grafik Canvas di browser
      │    ├─ buffer kanal pertama 60 detik → model TensorFlow → status APNEA/NORMAL
      │    └─ perekaman → CSV + laporan DOCX di reports/
      └─ Desktop: main.py → pemrosesan/prediksi/perekaman serupa → GUI PyQt6
```

Firmware di `ECG_Arduino_IDE/ECG_Arduino_IDE.ino` mengonfigurasi ADS1293 pada 100 Hz dan menamai perangkat Bluetooth **Wireless ECG 1**. Setiap baris berisi `ch1,ch2,ch3\n`; sekitar tiap 5 detik ditambah persentase baterai: `ch1,ch2,ch3,batt\n`. Nama `Lead_I`, `CH1_LA`, dan `CH2_RA` dipakai parser aplikasi; label Lead I/II/III di tampilan mengikuti penamaan proyek, bukan hasil perhitungan lead turunan yang terpisah.

Sinyal tampilan dan estimasi BPM melewati filter Butterworth bandpass **0,5–30 Hz**. BPM dihitung dengan deteksi puncak pada kanal pertama dari buffer hingga 5 detik; statusnya `Normal` (60–100 BPM), `Bradycardia` (<60), `Tachycardia` (>100), `Flat/Noise`, atau `LEAD OFF` bila nilai kanal melampaui ambang 8.000.000. Untuk AI, setiap **6.000 sampel / 60 detik** kanal pertama diproses dengan bandpass **0,5–40 Hz** dan normalisasi Z-score, kemudian dikirim ke `models/best_apnea_model_clean_60s.keras`. Probabilitas ≥0,5 ditampilkan sebagai `APNEA`, selain itu `NORMAL`; model `final_apnea_model_clean_60s.keras` tersedia tetapi tidak dipakai secara default.

## Tech stack dan letak kode

| Bagian | Teknologi / file utama | Tanggung jawab |
| --- | --- | --- |
| Firmware | ESP32, ADS1293, Arduino IDE, `protocentral_ads1293`, `BluetoothSerial`; `ECG_Arduino_IDE/ECG_Arduino_IDE.ino` | Akuisisi tiga kanal, baterai, transmisi serial |
| Web backend | Python, FastAPI, Uvicorn, PySerial; `backend/main.py`, `backend/bluetooth_manager.py` | Membaca port di host, memproses data, REST API dan WebSocket |
| Sinyal dan AI | NumPy, SciPy, TensorFlow/Keras; `backend/ecg_processor.py`, `backend/ai_inference.py`, `models/` | Filter, BPM, inferensi apnea |
| Frontend | HTML, CSS, JavaScript tanpa framework, Canvas, WebSocket, PWA; `backend/static/` | Grafik langsung, kontrol perangkat/rekaman, tampilan status |
| Desktop | PyQt6, pyqtgraph; `main.py` | Alternatif aplikasi lokal, berisi sendiri logika serial, sinyal, AI, dan laporan |
| Laporan | Matplotlib, python-docx; `backend/recording_manager.py`, `backend/report_generator.py` (web), `main.py` (desktop) | CSV data dan dokumen Word |

### Dependency dan kegunaannya

Dependency Python dipisahkan karena aplikasi web dan desktop tidak memakai antarmuka yang sama:

| Dependency | Web | Desktop | Kegunaan |
| --- |:---:|:---:|---|
| `fastapi` | ✓ | - | Framework server HTTP dan endpoint REST |
| `uvicorn[standard]` | ✓ | - | Menjalankan aplikasi FastAPI |
| `pyserial` | ✓ | ✓ | Membaca data dari COM port atau Bluetooth serial |
| `numpy` | ✓ | ✓ | Array numerik dan operasi sinyal |
| `scipy` | ✓ | ✓ | Filter Butterworth dan deteksi puncak ECG |
| `tensorflow` | ✓ | ✓ | Memuat model `.keras` dan inferensi Sleep Apnea |
| `python-docx` | ✓ | ✓ | Membuat laporan Word `.docx` |
| `matplotlib` | ✓ | ✓ | Membuat gambar plot ECG untuk laporan |
| `PyQt6` | - | ✓ | Framework GUI aplikasi desktop |
| `pyqtgraph` | - | ✓ | Plot ECG real-time pada desktop |
| `pandas` | - | ✓* | Utilitas data; tercantum di dependency desktop, tetapi tidak menjadi komponen utama alur saat ini |

File instalasi:

- **Web:** `backend/requirements.txt` — FastAPI, Uvicorn, PySerial, NumPy, SciPy, TensorFlow, Matplotlib, dan python-docx.
- **Desktop:** `requirements.txt` — PyQt6, PyQtGraph, PySerial, NumPy, SciPy, TensorFlow, Matplotlib, python-docx, dan pandas.
- **Firmware:** tidak memakai `pip`. Kompilasi melalui Arduino IDE membutuhkan board package ESP32 dan library `protocentral_ads1293`; `BluetoothSerial` dan `SPI` berasal dari ekosistem ESP32/Arduino.
- **Frontend browser/HP:** tidak memiliki `npm` atau dependency Node.js. Kode menggunakan HTML, CSS, JavaScript native, HTML5 Canvas, WebSocket browser, dan Service Worker bawaan browser.

Instal dependency sesuai aplikasi yang ingin dijalankan. Untuk web, tidak perlu memasang PyQt6 atau pyqtgraph; untuk desktop, tidak perlu menjalankan FastAPI/Uvicorn. TensorFlow adalah dependency paling berat dan paling sensitif terhadap versi Python/OS, sehingga gunakan Python 3.10–3.11 sesuai panduan proyek dan siapkan instalasi CPU/GPU yang sesuai mesin penerima.

### Peta kode web (juga untuk browser HP)

HP hanya **klien browser**: pengambilan data Bluetooth/serial, filter, AI, dan penyimpanan berjalan di laptop/PC yang menjalankan server. Ikuti alur ini saat membaca kode:

| Mulai dari | Gunanya → mengarah ke |
| --- | --- |
| `backend/static/index.html` + `css/styles.css` | Halaman, tiga kanvas ECG, tombol, modal pasien, dan tata letak responsif HP; memuat skrip `js/*.js`. |
| `backend/static/js/app.js` | Menghubungkan klik tombol dan pesan masuk: **Refresh** → `GET /api/ports`; **Connect/Record/Pause** → perintah WebSocket dari `websocket.js`; data masuk → `ecg_canvas.js` (grafik) atau `ui_manager.js` (status/BPM/baterai). |
| `backend/static/js/websocket.js` | Membuka `ws(s)://<host>/ws`, mengirim perintah JSON, menerima pesan seperti `ecg`, `hr`, `ai`, `recording`, dan tersambung ulang jika koneksi putus. |
| `backend/main.py` | Titik masuk FastAPI: melayani halaman dan `/ws`, menerima perintah; loop `process_ecg_data()` mengambil data dari `bluetooth_manager.py` → `ecg_processor.py` (filter/BPM), `ai_inference.py` (prediksi), `recording_manager.py` (rekam). Loop lain menyiarkan status tiap 1 detik dan sampel ECG tiap 50 ms melalui `websocket_manager.py`. |
| `backend/api/devices.py`, `recording.py`, `reports.py` | REST untuk daftar port, kendali/status rekaman, daftar serta unduh laporan. Frontend saat ini memakai REST untuk daftar port, tetapi kendali rekaman melalui WebSocket. |
| `backend/recording_manager.py` → `report_generator.py` | Saat stop rekam: simpan CSV mentah/terproses/anotasi dan buat DOCX di `reports/`. Konstanta/path web di `backend/config.py`; model AI di `models/`. |
| `backend/static/manifest.json` + `sw.js` | Metadata instalasi PWA dan cache file antarmuka; **bukan** pemrosesan ECG offline. |

Contoh jalur tombol **Connect**: `app.js` memanggil `ws.connectDevice(port)` → `websocket.js` mengirim `{type: 'connect', port}` → `/ws` di `backend/main.py` memanggil `BluetoothManager.connect()` → data perangkat dibaca dan diteruskan ke browser sebagai pesan `ecg`. Saat **Stop Recording**, `/ws` memanggil `RecordingManager.stop_recording()` → `report_generator.py` membuat laporan → browser menerima `report_saved` dan menampilkan lokasinya.

### Diagram hubungan modul

**Web:** Firmware mengirim data ke backend; FastAPI mengoordinasi pemrosesan, API, WebSocket, dan frontend browser. Garis putus-putus AI → perekaman menandai callback anotasi yang **belum terhubung**, bukan alur yang sudah berjalan.

![Hubungan modul aplikasi web: firmware, backend FastAPI, API, dan browser](resources/diagrams/web_module_relationships.svg)

**Desktop:** Seluruh kelas pemrosesan, serial, antarmuka, dan pembuat laporan berada dalam satu `main.py`. Diagram memecahnya menjadi komponen logis agar mudah diikuti; aplikasi desktop **tidak mengimpor backend**.

![Hubungan komponen aplikasi desktop dalam main.py](resources/diagrams/desktop_module_relationships.svg)

## Menjalankan dan menggunakan

Prasyarat: PC/laptop dengan Python dan Bluetooth/port serial, ESP32 + ADS1293 dengan firmware di atas, serta dependensi Arduino **Protocentral ADS1293** dan dukungan board ESP32 untuk kompilasi firmware. Gunakan lingkungan virtual; pilih versi Python yang kompatibel dengan TensorFlow di sistem Anda (Python 3.11 adalah pilihan awal yang sesuai panduan proyek). Instal dari **direktori akar repositori**.

**Web (disarankan untuk akses lewat browser):**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Buka <http://localhost:8000> **di laptop server**. Untuk membuka lewat HP: pastikan HP dan laptop berada di Wi-Fi yang sama, jalankan server dengan `--host 0.0.0.0`, lalu di browser HP buka `http://<IP-LAN-laptop>:8000` (misalnya `http://192.168.1.10:8000`; izinkan port 8000 pada firewall bila perlu). `localhost` di HP merujuk ke HP sendiri, bukan laptop. Pasangkan ESP32 dan pilih port serial **di laptop/server** melalui antarmuka HP; HP tidak terhubung langsung ke ESP32. Mode instalasi PWA/service worker di HP umumnya memerlukan HTTPS (atau `localhost` pada perangkat yang sama); akses HTTP melalui IP LAN tetap dapat dipakai untuk membuka halaman dan monitoring selama jaringan mengizinkan. Di Linux/macOS, aktifkan venv dengan `source .venv/bin/activate`. Jangan buka server ini ke jaringan publik tanpa pengamanan tambahan.

**Desktop (alternatif, bukan syarat untuk menjalankan web):**

```powershell
pip install -r requirements.txt
python main.py
```

Pada Windows, pasangkan **Wireless ECG 1** di pengaturan Bluetooth, cari nomor port COM di *Device Manager > Ports (COM & LPT)*, lalu di aplikasi klik **Refresh → pilih COM → Connect**. Port serial USB juga dapat dipilih. Di Linux, pengguna mungkin perlu masuk grup `dialout` dan memasangkan/mengikat perangkat ke `/dev/rfcomm*`. Tekan **Recording Time**, isi nama dan tanggal lahir, lalu tekan **Stop Recording & Save Report** untuk menyimpan sesi. **Pause** pada implementasi sekarang juga menghentikan pemrosesan sampel selama jeda (bukan sekadar membekukan grafik).

Web mengekspos `GET /api/ports`, `GET /api/status`, `POST /api/recording/start`, `POST /api/recording/stop`, `GET /api/recording/status`, `GET /api/reports`, dan `GET /api/reports/{session_id}/download/{filename}`. Kontrol langsung dan data berkala menggunakan `WS /ws`.

## Data tersimpan dan catatan serah-terima

Tidak ada database. Saat rekaman dihentikan, aplikasi membuat `reports/<Nama>_<YYYYMMDD_HHMMSS>/` berisi:

### ERD penyimpanan web

![ERD web: sesi perekaman, CSV mentah, CSV terproses, anotasi AI, dan laporan Word](resources/diagrams/web_storage_erd.svg)

### ERD penyimpanan desktop

![ERD desktop: sesi perekaman, CSV mentah, CSV terproses, anotasi AI, dan laporan Word](resources/diagrams/desktop_storage_erd.svg)

Kedua ERD adalah **model konseptual relasi file**, bukan tabel SQL: satu folder sesi berisi masing-masing satu file RAW, PROCESSED, ANNOTATION dan DOCX. Angka `many rows` berarti banyak baris dalam CSV, bukan banyak file. Metadata sesi disimpan pada nama folder dan sebagian dalam DOCX; **tidak ada tabel atau file metadata sesi tersendiri**. Di web CSV anotasi dapat hanya berisi header karena callback pencatatan AI belum dipasang; di desktop hasil prediksi yang terjadi saat merekam masuk ke CSV anotasi.

| File | Isi |
| --- | --- |
| `ECG_RAW_*.csv` | Timestamp dan tiga angka kanal mentah dari perangkat |
| `ECG_PROCESSED_*.csv` | Tiga kanal hasil filter, dinormalisasi Z-score per sesi |
| `ECG_AI_ANNOTATION_*.csv` | Timestamp, detik sejak mulai, status dan probabilitas AI (bila tercatat) |
| `ECG_REPORT_*.docx` | Identitas pasien, status jantung, ringkasan AI, jumlah sampel, serta plot segmen hingga 10 detik |

**Hal yang perlu diketahui penerima proyek:**

- Di jalur **web**, `AIInference.on_prediction` belum dihubungkan ke `RecordingManager.add_ai_result`; status AI dapat tampil, tetapi CSV anotasi dan ringkasan AI laporan web bisa kosong. Desktop sudah mencatat hasil AI saat sedang merekam.
- `RecordingManager.stop_recording()` mengosongkan waktu mulai sebelum membuat laporan; akibatnya durasi sesi di laporan web saat ini menjadi `00:00:00`. Label **Avg Heart Rate** pada laporan sebenarnya memakai BPM terakhir, bukan rata-rata sesi.
- Web menyimpan state port/rekaman secara global tanpa autentikasi; beberapa browser memakai perangkat dan sesi yang sama. Data pasien disimpan lokal dalam file, sehingga akses server dan folder `reports/` perlu dibatasi. Belum ada rangkaian tes otomatis atau data simulasi perangkat di repositori.
- Firmware mencetak data debug ke Serial USB dengan format berlabel (`CH1: ...`), sedangkan data CSV yang dibaca aplikasi dikirim lewat Bluetooth. Bila memakai USB langsung, diperlukan format CSV yang sesuai parser aplikasi.

Dependensi Python dicatat terpisah di `backend/requirements.txt` (web) dan `requirements.txt` (desktop). Parameter bersama web ada di `backend/config.py`; konstanta desktop didefinisikan di `main.py`. Sumber keempat diagram ada di `resources/diagrams/*.dot`, hasil render SVG di folder yang sama. Untuk memperbarui gambar setelah mengedit sumber, instal Graphviz lalu jalankan `dot -Tsvg resources/diagrams/web_storage_erd.dot -o resources/diagrams/web_storage_erd.svg` (ulangi untuk tiga diagram lainnya). SVG dapat dilihat langsung di README GitHub atau browser tanpa konversi. Diagram lama di `resources/relations_diagram.png`, `dfd_diagram.png`, dan `erd_diagram.png` adalah artefak dokumentasi awal dan tidak dipakai sebagai acuan empat diagram baru ini.
