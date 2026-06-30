//////////////////////////////////////////////////////////////////////////////////////////
//
//  Protocentral ADS1293 Arduino example — 3-lead ECG (Arduino Plotter)
//
//  Author: Ashwin Whitchurch, Protocentral Electronics
//  SPDX-FileCopyrightText: 2025 Protocentral Electronics
//  SPDX-License-Identifier: MIT
//
//  Modifikasi oleh: Gemini
//  Logika baru: Menggunakan millis() untuk mengirim data baterai setiap 5 detik
//  agar tidak memblokir loop EKG (DRDY).
//
/////////////////////////////////////////////////////////////////////////////////////////

#include "protocentral_ads1293.h"
#include "BluetoothSerial.h"
#include <SPI.h>

#define DRDY_PIN 2
#define CS_PIN 5
#define BATTERY_PIN 34 // Pin ADC untuk pembacaan baterai

#if !defined(SCK_PIN)
#if defined(ARDUINO_ARCH_ESP32)
#define SCK_PIN 18
#define MISO_PIN 19
#define MOSI_PIN 23
#else
#define SCK_PIN 13
#define MISO_PIN 12
#define MOSI_PIN 11
#endif
#endif

ads1293 ADS1293(DRDY_PIN, CS_PIN);
BluetoothSerial SerialBT;

// --- KONFIGURASI BATERAI ---
const float R1 = 100000.0;
const float R2 = 220000.0;
const float VOLT_MAX = 4.2;
const float VOLT_MIN = 3.0;
const int READ_SAMPLES = 20;
const float VOLTAGE_DIVIDER_RATIO = (R1 + R2) / R2;

// --- MODIFIKASI BARU: Variabel Timer untuk Baterai ---
// Interval 5000 ms = 5 detik (Sesuai dengan nilai yang Anda definisikan)
const long batteryCheckInterval = 5000; 
unsigned long lastBatteryCheck = 0;      // Waktu terakhir cek baterai
int latestBatteryPercent = 0;            // Menyimpan nilai persentase terakhir
bool sendBatteryData = false;            // Flag untuk menandai pengiriman data
// --- AKHIR MODIFIKASI ---


/**
 * @brief Membaca voltase baterai yang sudah dikalkulasi.
 */
float readBatteryVoltage() {
  long total_mv = 0;
  // Perhatian: analogReadMilliVolts hanya ada di ESP32. Jika menggunakan Arduino Uno/Mega, 
  // ganti dengan analogRead() dan konversi manual.
  for (int i = 0; i < READ_SAMPLES; i++) {
    total_mv += analogReadMilliVolts(BATTERY_PIN);
    delay(1); // Jeda singkat antar bacaan
  }
  float avg_volt_adc = (total_mv / (float)READ_SAMPLES) / 1000.0;
  float battery_voltage = avg_volt_adc * VOLTAGE_DIVIDER_RATIO;
  return battery_voltage;
}

/**
 * @brief Mengkonversi voltase baterai ke persentase.
 */
float voltageToPercentage(float voltage) {
  float percentage = (voltage - VOLT_MIN) / (VOLT_MAX - VOLT_MIN) * 100.0;
  return constrain(percentage, 0.0, 100.0);
}


void setup()
{
  Serial.begin(115200);

  pinMode(BATTERY_PIN, INPUT);

#if defined(ARDUINO_ARCH_ESP32)
  // Inisialisasi SPI untuk ESP32
  ADS1293.begin(SCK_PIN, MISO_PIN, MOSI_PIN); 
#else
  // Inisialisasi SPI standar untuk Arduino lainnya
  ADS1293.begin(); 
#endif

  // --- Konfigurasi ADS1293 (Tidak Berubah) ---
  ADS1293.configureChannel1(FlexCh1Mode::Default);
  ADS1293.configureChannel2(FlexCh2Mode::Default);
  ADS1293.enableCommonModeDetection(CMDetMode::Enabled);
  ADS1293.configureRLD(RLDMode::Default);
  ADS1293.configureOscillator(OscMode::Default);

  ADS1293.configureAFEShutdown(AFEShutdownMode::AFE_On);
  ADS1293.setSamplingRate(ADS1293::SamplingRate::SPS_100);

  ADS1293.setChannelGain(1, ADS1293::PgaGain::G8);
  ADS1293.setChannelGain(2, ADS1293::PgaGain::G8);
  ADS1293.setChannelGain(3, ADS1293::PgaGain::G8);

  ADS1293.configureDRDYSource(DRDYSource::Default);
  ADS1293.configureChannelConfig(ChannelConfig::Default3Lead);
  ADS1293.applyGlobalConfig(GlobalConfig::Start);
  // ------------------------------------------

  if (!SerialBT.begin("Wireless ECG 1")) {
    Serial.println("An error occurred initializing Bluetooth");
  } else {
    Serial.println("Bluetooth initialized. Ready to pair!");
  }
  
  // Lakukan satu kali pembacaan baterai saat setup
  float voltage = readBatteryVoltage();
  latestBatteryPercent = voltageToPercentage(voltage);
  lastBatteryCheck = millis(); // Set timer awal
  
  delay(1000);
}

void loop()
{
  // 1. Cek Baterai Non-Blocking
  // Membaca dan memperbarui status baterai setiap 'batteryCheckInterval' (5 detik)
  unsigned long currentMillis = millis();
  if (currentMillis - lastBatteryCheck >= batteryCheckInterval) {
    lastBatteryCheck = currentMillis; // Reset timer
    
    // Pembacaan ADC Baterai
    float voltage = readBatteryVoltage();
    latestBatteryPercent = voltageToPercentage(voltage);
    
    // Set flag agar data baterai dikirimkan saat data EKG berikutnya siap
    sendBatteryData = true; 
  }

  // 2. Cek EKG (Data Ready)
  // Bagian ini harus berjalan secepat mungkin
  if (digitalRead(DRDY_PIN) == LOW)
  {
    auto samples = ADS1293.getECGData();

    // Debugging data EKG via Serial Monitor
    Serial.print("CH1: "); Serial.print(samples.ch1);
    Serial.print(", CH2: "); Serial.print(samples.ch2);
    Serial.print(", CH3: "); Serial.print(samples.ch3);
    Serial.print(", OK: "); Serial.println(samples.ok);

    if (samples.ok)
    {
      // Kirim Data EKG via Bluetooth (Selalu 3 Channel)
      SerialBT.print(samples.ch1);
      SerialBT.print(',');
      SerialBT.print(samples.ch2);
      SerialBT.print(',');
      SerialBT.print(samples.ch3);
      
      // Kirim Data Baterai (Bersyarat)
      if (sendBatteryData) {
        // Jika flag aktif, tambahkan data persentase baterai
        SerialBT.print(',');
        SerialBT.println(latestBatteryPercent); // Kirim 4 data (diakhiri newline)
        sendBatteryData = false; // Reset flag setelah terkirim
      } else {
        // Jika flag tidak aktif, tutup paket data 3 channel EKG dengan newline
        SerialBT.println(); 
      }
    }
  }
  
  // Hapus semua delay(x) dari loop untuk menjaga kecepatan pembacaan DRDY
}