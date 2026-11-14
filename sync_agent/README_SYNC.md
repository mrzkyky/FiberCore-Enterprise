# 🛰️ FiberCore Google Earth Pro Auto-Sync Agent

Agent otomatis ini memungkinkan Anda mengedit file KMZ langsung di **Google Earth Pro** (menambah tiang, menarik kabel, atau menghapus ODP/Closure) dan perubahannya **otomatis tersinkronisasi detik itu juga ke web FiberCore Enterprise** tanpa perlu upload manual lewat web!

---

## 🚀 Cara Menggunakan:

### 1. Menjalankan Agent
* Di Windows: Cukup **double-click** file `start_agent.bat`
* Atau lewat Command Prompt / Terminal:
  ```bash
  python fibercore_sync_agent.py
  ```

Agent akan otomatis membuat folder `kmz_files/` di samping script jika belum ada.

---

### 2. Mengedit di Google Earth Pro
1. Simpan atau letakkan file `.kmz` proyek Anda di dalam folder `sync_agent/kmz_files/` (misal: `Surabaya_Cluster1.kmz`).
2. Buka file KMZ tersebut di **Google Earth Pro**.
3. Silakan lakukan pengeditan:
   * Tambah placemark / tiang baru
   * Gambar jalur kabel / line baru
   * Hapus titik yang salah
4. Setelah selesai, klik kanan folder tempat Anda mengedit di panel kiri Google Earth Pro -> **"Save Place As..."** (atau timpa file `Surabaya_Cluster1.kmz` tersebut di folder `kmz_files/`).
5. **Selesai!**
   * Di jendela Sync Agent akan muncul log:  
     `✅ Sinkronisasi BERHASIL! Data terupdate: 170 Node, 12 Jalur Kabel.`
   * Buka peta di browser Anda (`http://100.93.168.56:3004/map`), titik baru atau titik yang Anda hapus sudah langsung ter-update di layar!

---

## ⚙️ Pengaturan (`config.json`):

Anda bisa menyesuaikan pengaturan di file `config.json`:
```json
{
    "server_url": "http://100.93.168.56:8086",
    "watch_folder": "./kmz_files",
    "use_filename_as_region": true,
    "auto_replace": true,
    "debounce_seconds": 1.5
}
```
* `server_url`: Alamat backend FiberCore Anda.
* `watch_folder`: Folder yang dipantau (bisa Anda ganti ke folder kerja Anda sendiri di laptop).
* `use_filename_as_region`: Jika `true`, nama file KMZ akan otomatis dijadikan nama Region (contoh: `Cluster_A.kmz` -> Region `Cluster_A`).
* `auto_replace`: Jika `true`, data lama di region tersebut akan digantikan dengan data hasil editan terbaru.
