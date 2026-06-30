# Rencana Pelaksanaan Proyek (RPP)

**No.FO.8.6.1-V1**
**3 November 2023**

| Field | Detail |
|-------|--------|
| Nomor ID | MK20255SB010 |
| Pengusul Proyek | Nadya Farastanti |
| Manajer Proyek | Dr. Abdurrahman Dwijotomo, S.ST., M.Sc. |
| Judul Proyek | ECG Wireless Berbasis AI |
| Luaran | Mampu merekam atau membaca denyut jantung |
| Sponsor | Penelitian BIMA |
| Klien/Pelanggan | Politeknik Negeri Batam |
| Waktu | 6 bulan (Semester Ganjil TA 2025-2026) |

---

## 1. Ruang Lingkup

Ruang lingkup dari proyek ini mencakup perancangan dan pengembangan alat perekam denyut jantung dan morfologi elektrokardiogram (EKG) portabel yang beroperasi secara nirkabel (tanpa kabel). Proyek ini bertujuan untuk memfasilitasi pengguna dalam melakukan asesmen mandiri (self-assessment) kesehatan jantung secara praktis dan real-time.

Sistem ini akan mengintegrasikan sensor EKG non-invasif dengan mikrokontroler dan modul komunikasi nirkabel (seperti Bluetooth) untuk mengirimkan data sinyal EKG yang telah diakuisisi ke perangkat antarmuka, seperti ponsel pintar atau komputer, untuk visualisasi dan analisis dasar.

Tahapan pekerjaan meliputi:

- Studi literatur mengenai teknologi sensor EKG, metode pemrosesan sinyal EKG, dan sistem pemantauan kesehatan nirkabel.
- Perancangan dan pemilihan komponen perangkat keras (hardware), termasuk mikrokontroler seperti ESP32, sensor EKG yang kami pakai adalah ADS1293.
- Pengembangan perangkat lunak (software) untuk akuisisi data EKG pada mikrokontroler, filtrasi sinyal dasar, dan transmisi data secara nirkabel.
- Perancangan antarmuka pengguna (GUI) pada desktop untuk menampilkan visualisasi grafik EKG (morfologi) dan nilai denyut jantung (Heart Rate) secara real-time.
- Pengujian fungsionalitas sistem secara terintegrasi, mencakup akurasi pembacaan denyut jantung dan keandalan transmisi data nirkabel.
- Evaluasi performa alat (dibandingkan dengan alat ukur standar jika memungkinkan) dan penyusunan dokumentasi akhir proyek.

---

## 2. Desain Umum

**Gambar 1. Gambaran umum alat**

Alur kerja sistem dimulai ketika perangkat diaktifkan (Switch ON). Pada tahap awal, sistem melakukan inisialisasi dan pengaturan (setup), yang mencakup pembentukan komunikasi protokol SPI antara mikrokontroler ESP32 dengan modul sensor CJMCU-1293, serta membangun koneksi Bluetooth untuk menghubungkan perangkat keras dengan aplikasi desktop.

Setelah koneksi terbentuk, sensor CJMCU-1293 mulai mengakuisisi sinyal biopotensial dengan membaca elektroda yang terpasang pada tubuh pasien. Data sinyal mentah (raw data) yang diperoleh kemudian ditransmisikan secara nirkabel ke aplikasi desktop untuk diproses lebih lanjut.

Pada sisi aplikasi desktop, data yang diterima akan melewati tahap pra-pemrosesan (preprocessing) menggunakan bandpass filter dan normalisasi z-score untuk menghilangkan noise. Setelah sinyal bersih, algoritma kecerdasan buatan (AI) melakukan deteksi anomali, dan hasilnya ditampilkan secara visual melalui Antarmuka Pengguna Grafis (GUI). Pengguna memiliki opsi untuk menekan tombol print out guna mencetak laporan aktivitas yang berisi grafik sinyal EKG digital dan kesimpulan rekaman. Proses ini akan terus berulang (looping) secara real-time hingga perangkat dimatikan (Switch OFF).

---

## 3. Konstruksi Produk

### Desain Mekanikal

- **Gambar 2.** Gambaran pemakaian
- **Gambar 3.** Desain tampak isometric
- **Gambar 4.** Desain tampak depan
- **Gambar 5.** Desain tampang sisi kanan
- **Gambar 6.** Tampilan dalam bagian bawah
- **Gambar 7.** Tampilan dalam bagian atas
- **Gambar 8.** Desain belt
- **Gambar 9.** Desain lead (Lead 1, Lead 2, Lead 3, Lead 4)

### Desain Elektrikal

- **Gambar 10.** Skematik ESP32 Connection
- **Gambar 11.** Skematik Battery Management Connection
- **Gambar 12.** Skematik 3.3V Regulator

### Desain Grafis Antarmuka

- **Gambar 13.** Tampilan GUI

---

## 4. Kebutuhan Peralatan/Perangkat dan Bahan/Komponen

| Fase/Proses | Peralatan/Perangkat (SW/HW) | Bahan/Komponen |
|-------------|---------------------------|----------------|
| Fase 1 - Identifikasi masalah dan riset | Laptop (3) - Mencari solusi dari masalah yang ada | - |
| Fase 2 - Merancang system kerja | Laptop (3) - Software Visio | - |
| Fase 3 - Perancangan desain mekanikal dan elektrikal produk | Laptop, PC (@1) - Software Solidworks dan Kicad | - |
| Fase 4 - Fabrikasi | Mesin 3D Print, Mesin Jahit, Solder (@1) - Software Creality Slicer untuk 3D Printing | Filament (2 roll, PLA+), Webbing (2 roll, 120cm/item), Resistor (2 pcs, 220K dan 110K), Regulator (1 pc, AMS 1117), Kapasitor (1 pc, 1uf/50v), DC Booster (1 pc), ESP (1 pc, ESP32 Devkit), ADS1293 (1 pc), Battery (1 pc, Lipo 2000mAH), Charger Modul (1 pc), Rocker Switch (1 pc), PCB (1 pc, Double Layer) |
| Fase 5 - Uji Coba Alat 1 | Wireless ECG (2), PC (3), Program Python | Raspberry Pi 5 (1) |
| Fase 6 - Pembuatan Model | Laptop (@1) - Menggunakan Software VS Code, Menggunakan Metode CNN | Dataset (1, Github), Bahasa Python |
| Fase 7 - Training | Laptop (@3) | - |
| Fase 8 - Uji Coba Alat dengan Model AI | Laptop (2), Wireless ECG (1) - Pengujian alat secara real time | Raspberry Pi 5 (1) |
| Fase 9 - Finalisasi Project | Laptop, PC (@2) - Mengoptimalkan alat dan firmware, Menyusun luaran PBL | Raspberry Pi 5 (1) |

---

## 5. Tantangan dan Isu

| No | Tahapan Pekerjaan | Bahaya | Risiko (Konsekuensi) | Kemungkinan (a) | Keparahan (b) | Total (axb) | Tingkat Risiko | Pengendalian Risiko |
|----|-------------------|--------|----------------------|-----------------|---------------|-------------|----------------|---------------------|
| 1 | Menyolder komponen elektronik | 1. Terkena mata solder<br>2. Terpapar asap solder | 1. Melepuh<br>2. Sesak nafas / gangguan pernafasan | 5 | 5 | 25 | Ekstrem | 1. Safety briefing<br>2. Meletakkan solder pada tempat yang aman seperti pada stand yang ada<br>3. Menggunakan masker |
| 2 | Memotong kabel | Sisi tajam pada stripper | Tergores / luka | 2 | 2 | 4 | Sedang | 1. Safety Briefing<br>2. Menggunakan sarung tangan karet |
| 3 | Commissioning | Listrik | 1. Alat/perangkat rusak<br>2. Terbakar<br>3. Short Circuit | 4 | 2 | 8 | Tinggi | 1. Safety briefing<br>2. Melakukan pengecekan alat bersama manpro/pembimbing sebelum menggunakan alat |
| 4 | Proses pembuatan pemrograman | Terpapar layar laptop dalam waktu yang lama | Gangguan mata, kelelahan otot | 4 | 2 | 8 | Tinggi | 1. Lakukan peregangan 15-20 menit<br>2. Gunakan layar dengan cahaya biru<br>3. Mengatur posisi duduk yang ergonomis |

---

## 6. Estimasi Waktu Pekerjaan

| Fase/Proses | Uraian Pekerjaan | Estimasi Waktu | Catatan |
|-------------|------------------|----------------|---------|
| Mekanikal | Mendesain produk menggunakan Solidworks dan fabrikasi | Desain produk: 14 minggu, Fabrikasi: 5 minggu | Desain Casing & Ergonomi (CAD), Prototyping Casing (3D Print), Finalisasi Desain |
| Elektrikal | Merangkai komponen elektronik sesuai skematik yang sudah dibuat | Desain skematik: 2 minggu, Perakitan dan uji coba: 8 minggu | Desain Skematik (ECG AFE, Power, MCU), Assembly & Uji Coba |
| Pemrograman GUI | Membuat program GUI menggunakan Visual Studio dengan Bahasa pemrograman Python | 11 minggu | Desain UI/UX & Setup Project (PyQt, etc.), Koneksi Bluetooth & Parsing Data, Real-time Plotting & Ikon Baterai, Sinyal & Baterai Stabil |
| Training Model Deteksi Sleep Apnea | Membuat model deteksi sleep apnea dari dataset yang sudah dianotasi dari internet dan training data tersebut | 4 Minggu | Riset & Pengumpulan Data (Data ECG tidur), Preprocessing (Bandpass filter, Z-Score normalization), Training & Validasi Model (Offline), Integrasi Model (ke GUI/Cloud), Pengujian Sistem |

---

## 7. Biaya Proyek (Biaya Bahan dan Peralatan)

| No | Jenis Pengeluaran | Volume | Harga Satuan (Rp) | Total (Rp) |
|----|-------------------|--------|--------------------|------------|
| 1 | ESP32 Dev Module (Wi-Fi + BT) | 2 | Rp85.000 | Rp170.000 |
| 2 | Sensor EKG (AD8232/ADS1293) + Kabel | 2 | Rp975.000 | Rp1.950.000 |
| 3 | Elektroda EKG (Gel Pad) - Pack | 2 | Rp67.850 | Rp135.700 |
| 4 | Baterai LiPo 3.7V Dengan PCM 2A | 2 | Rp44.500 | Rp89.000 |
| 5 | IP2312 Type-C USB Input High Current 3A Lithium Battery Fast Charging | 2 | Rp24.900 | Rp49.800 |
| 6 | Kabel EMG/EKG/ECG Cable | 2 | Rp48.000 | Rp96.000 |
| 7 | Filament Esun PLA+ Putih - Roll | 2 | Rp228.000 | Rp456.000 |
| 8 | Stiker Alkantara Dark Grey - Lembar | 2 | Rp139.000 | Rp278.000 |
| 9 | Raspberry Pi 5 KIT NVME SSD 256GB | 2 | Rp5.100.000 | Rp10.200.000 |
| 10 | Webbing 3cm - Roll | 1 | Rp50.000 | Rp50.000 |
| 11 | SD card Lexar | 2 | Rp579.400 | Rp1.158.800 |
| 12 | Dot PCB 80x20mm | 2 | Rp2.500 | Rp5.000 |
| 13 | Resistor 1/2watt | 10 | Rp100 | Rp1.000 |
| 14 | Pin Header Female 40 Pin | 3 | Rp3.000 | Rp9.000 |
| 15 | Spacer 5mm | 8 | Rp2.500 | Rp20.000 |
| 16 | Threaded Insert M3 | 8 | Rp1.000 | Rp8.000 |
| 17 | Baut JP M3 10mm | 8 | Rp250 | Rp2.000 |
| 18 | Rocker Switch | 2 | Rp1.500 | Rp3.000 |
| 19 | AMS1117 3.3V Regulator | 3 | Rp1.500 | Rp4.500 |
| 20 | DC Booster | 2 | Rp15.000 | Rp30.000 |
| 21 | Kapasitor 22uF | 4 | Rp250 | Rp1.000 |
| 22 | Kapasitor 10uF | 4 | Rp250 | Rp1.000 |
| 23 | Timah - Roll | 1 | Rp20.000 | Rp20.000 |
| 24 | Pasta Solder | 1 | Rp42.000 | Rp42.000 |
| 25 | Kabel AWG22 | 1 | Rp3.000 | Rp3.000 |
| 26 | Kabel AWG26 | 2 | Rp1.500 | Rp3.000 |
| 27 | PCB 7x4cm | 1 | Rp10.000 | Rp10.000 |
| 28 | ADS1115 Module | 1 | Rp85.000 | Rp85.000 |
| 29 | Kabel Mini HDMI | 1 | Rp25.000 | Rp25.000 |
| 30 | OTG Mikro | 1 | Rp38.000 | Rp38.000 |
| 31 | PC-817 (Slop) | 4 | Rp2.000 | Rp8.000 |
| 32 | Mata Solder 40w Hanwin | 1 | Rp15.000 | Rp15.000 |
| 33 | Spacer 0.5cm | 4 | Rp1.000 | Rp4.000 |
| 34 | Ceramic 100N | 4 | Rp250 | Rp1.000 |
| | **GRAND TOTAL** | | | **Rp14.971.800** |

---

## 8. Tim Proyek (Dosen, Laboran dan/atau Mahasiswa)

| No | Nama | NIK/NIM | Program Studi |
|----|------|---------|---------------|
| 1 | Dr. Abdurrahman Dwijotomo, S.ST., M.Sc. | 122257 | Teknik Mekatronika |
| 2 | Nadya Farastanti | 4212301040 | Teknik Mekatronika |
| 3 | Muhammad Fikri Hamid | 4212301034 | Teknik Mekatronika |
| 4 | Muhammad Falih Muhadzdzib | 4212301044 | Teknik Mekatronika |

---

## 9. Ruang Kerja (Workspace)/Laboratorium/Workshop

- Ruang 402
- Ruang 502
- Lingkungan Kampus
- Lingkungan luar kampus

---

## 10. Mata Kuliah, Capaian Pembelajaran dan Capaian Pembelajaran Mata Kuliah yang Terlibat

| No | Nama Mata Kuliah | Capaian Pembelajaran | Capaian Pembelajaran Mata Kuliah |
|----|------------------|----------------------|----------------------------------|
| 1 | Matematika Teknik | Mampu menerapkan konsep matematika rekayasa untuk analisis sistem dan pengolahan sinyal | Mahasiswa mampu menerapkan materi orde 3, menerapkan materi transformasi laplace dan materi Filter untuk memproses sinyal analog dari sensor ECG agar data bebas dari noise |
| 2 | Desain Berbantu Komputer Lanjut | Mampu merancang desain mekanikal yang presisi dan ergonomis menggunakan perangkat lunak CAD 3D | Mahasiswa mampu merancang dan mensimulasikan desain enclosure (casing) alat ECG yang ergonomis dan pas untuk penempatan komponen elektronik (PCB & Baterai) |
| 3 | Machine Vision | Mampu menerapkan algoritma pengenalan pola dan kecerdasan buatan pada data visual/sinyal | Mahasiswa mampu mengintegrasikan model AI (seperti SVM atau CNN) ke dalam aplikasi Python untuk mendeteksi pola abnormal (aritmia) dari grafik visual sinyal jantung |
| 4 | Statistika Industri | Mampu menggunakan metode statistik untuk pengumpulan, pengolahan, dan analisis data | Mahasiswa mampu mengumpulkan data pengujian sensor ADS1293 dan melakukan uji validitas/reliabilitas dibandingkan dengan alat medis standar untuk memastikan akurasi alat |
| 5 | Bahasa Inggris Umum | Mampu berkomunikasi dan menyusun dokumen teknis dalam Bahasa Inggris | Mahasiswa mampu menyusun dokumen, laporan, atau presentasi proyek dengan struktur dalam bahasa Inggris |

---

## 11. Komunikasi antara Manajer Proyek dan Klien

| Fase/Proses | Pertanyaan/Komentar | Jawaban | Catatan |
|-------------|---------------------|---------|---------|
| Keseluruhan | Meminta izin pemakaian ruangan untuk pengerjaan proyek, Meminta izin pemakaian monitor, keyboard, dan lain-lain | Diizinkan | |

---

## 12. Monitoring dan Evaluasi

-

---

## 13. Riwayat Perubahan Proyek yang Akan Ditangani

| No | Revisi/Tanggal | Deskripsi Perubahan | Originator |
|----|----------------|---------------------|------------|
| | | | |

---

## Tanda Tangan Persetujuan

**Batam, DD/MM/YY**

| Klien | P3M | SHILAU | Manajer Proyek |
|-------|-----|--------|----------------|
| | | | Dr. Abdurrahman Dwijotomo, S.ST., M.Sc. |

| Kajur | Kajur | KPS | KPS |
|-------|-------|-----|-----|
| ____ | ____ | _____ | ______ |
