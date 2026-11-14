#!/usr/bin/env python3
"""
FiberCore Enterprise - Google Earth Pro Auto-Sync Agent
Monitors a folder for edited .kmz / .kml files from Google Earth Pro
and automatically syncs changes to the FiberCore server in real-time.
"""

import os
import sys
import time
import json
import urllib.request
import urllib.parse
from datetime import datetime

# Load configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, "config.json")

DEFAULT_CONFIG = {
    "server_url": "http://100.93.168.56:8086",
    "watch_folder": "./kmz_files",
    "default_region": "Surabaya",
    "use_filename_as_region": True,
    "auto_replace": True,
    "debounce_seconds": 1.5,
    "check_interval_seconds": 1.0
}

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                cfg = json.load(f)
                return {**DEFAULT_CONFIG, **cfg}
        except Exception as e:
            print(f"[!] Warning: Failed to read config.json, using defaults: {e}")
    else:
        # Create default config file
        with open(CONFIG_FILE, "w") as f:
            json.dump(DEFAULT_CONFIG, f, indent=4)
    return DEFAULT_CONFIG

def upload_kmz(file_path, server_url, region, replace=True):
    """Uploads a KMZ/KML file to the FiberCore /api/v1/uploads/kml endpoint."""
    filename = os.path.basename(file_path)
    endpoint = f"{server_url.rstrip('/')}/api/v1/uploads/kml?region={urllib.parse.quote(region)}&replace={str(replace).lower()}"
    
    boundary = f"----WebKitFormBoundary{os.urandom(16).hex()}"
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: application/vnd.google-earth.kmz\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "FiberCore-SyncAgent/1.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
            res_json = json.loads(data)
            return True, res_json
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        return False, f"HTTP Error {e.code}: {err_msg}"
    except Exception as e:
        return False, str(e)

def main():
    cfg = load_config()
    server_url = cfg["server_url"]
    watch_folder = os.path.abspath(cfg["watch_folder"])
    debounce = cfg.get("debounce_seconds", 1.5)
    interval = cfg.get("check_interval_seconds", 1.0)

    if not os.path.exists(watch_folder):
        os.makedirs(watch_folder, exist_ok=True)

    print("=" * 65)
    print("🛰️  FIBERCORE ENTERPRISE - GOOGLE EARTH AUTO-SYNC AGENT")
    print("=" * 65)
    print(f"📡 Server URL     : {server_url}")
    print(f"📁 Monitored Dir  : {watch_folder}")
    print(f"⏱️  Debounce Time  : {debounce}s")
    print(f"🔄 Auto-Replace   : {cfg.get('auto_replace', True)}")
    print("=" * 65)
    print("Petunjuk Penggunaan:")
    print("1. Simpan/Save file .kmz atau .kml pekerjaan Anda ke folder di atas.")
    print("2. Setiap kali Anda tekan Ctrl+S atau Save Place As di Google Earth,")
    print("   agent ini akan otomatis mengupload perubahan ke server FiberCore.")
    print("3. Tampilan peta di web browser akan langsung ter-update otomatis.")
    print("-" * 65)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🟢 Agent aktif! Menunggu perubahan file...\n")

    # Tracking modified times: {filepath: last_mtime}
    tracked_files = {}

    # Initialize current file timestamps
    for fname in os.listdir(watch_folder):
        if fname.lower().endswith((".kmz", ".kml")):
            fpath = os.path.join(watch_folder, fname)
            tracked_files[fpath] = os.path.getmtime(fpath)

    while True:
        try:
            current_files = {}
            for fname in os.listdir(watch_folder):
                if fname.lower().endswith((".kmz", ".kml")):
                    fpath = os.path.join(watch_folder, fname)
                    current_files[fpath] = os.path.getmtime(fpath)

            for fpath, mtime in current_files.items():
                last_mtime = tracked_files.get(fpath, 0)
                if mtime > last_mtime:
                    fname = os.path.basename(fpath)
                    now_str = datetime.now().strftime("%H:%M:%S")
                    print(f"[{now_str}] ✏️  Perubahan terdeteksi pada: {fname}")
                    
                    # Debounce: Tunggu sampai Google Earth Pro selesai menulis file
                    time.sleep(debounce)
                    
                    # Tentukan nama region
                    if cfg.get("use_filename_as_region", True):
                        region = os.path.splitext(fname)[0]
                    else:
                        region = cfg.get("default_region", "Surabaya")

                    fsize_kb = os.path.getsize(fpath) / 1024
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🚀 Mengirim {fname} ({fsize_kb:.1f} KB) ke region [{region}]...")
                    
                    ok, res = upload_kmz(
                        file_path=fpath,
                        server_url=server_url,
                        region=region,
                        replace=cfg.get("auto_replace", True)
                    )

                    if ok:
                        cables_count = len(res.get("cables", []))
                        devices_count = res.get("devices_count", 0)
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Sinkronisasi BERHASIL!")
                        print(f"    📊 Data terupdate: {devices_count} Node/Tiang/ODP, {cables_count} Jalur Kabel.")
                        print(f"    🌐 Peta web langsung ter-update!\n")
                    else:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Gagal upload: {res}\n")

                    # Update tracked mtime to current
                    tracked_files[fpath] = os.path.getmtime(fpath)

            time.sleep(interval)
        except KeyboardInterrupt:
            print("\n[!] Agent dihentikan oleh pengguna.")
            sys.exit(0)
        except Exception as e:
            print(f"[!] Error: {e}")
            time.sleep(2)

if __name__ == "__main__":
    main()
