"use strict";

// ─── Help printers ───────────────────────────────────────────────────────────
function printRootHelp() {
  console.log(`usage: seotask [-h] {login,creds,credentials,fingerprint,telegram,status,start,stop,service,log,earnings,estimate,doctor,health,version,update,uninstall} ...

CLI ringkas SeoTask: login, creds, fingerprint, telegram, status, start, stop, service, log, earnings, estimate, doctor, health, version, update, uninstall.

positional arguments:
  {login,creds,credentials,fingerprint,telegram,status,start,stop,service,log,earnings,estimate,doctor,health,version,update,uninstall}
    login               Login akun menggunakan email/password atau cookie.
    creds (credentials)
                        Setup credentials untuk auto relogin (atau cek status
                        credentials).
    fingerprint         Kelola fingerprint Android unik per VPS.
    telegram            Kelola notifikasi earnings harian via Telegram.
    status              Cek status sesi, info akun, dan saldo RUB.
    start               Mulai runner headless: get_task -> countdown ->
                        complete_task.
    stop                Hentikan runner headless yang sedang berjalan.
    service             Kelola service systemd agar auto-start saat VPS
                        reboot.
    log                 Tampilkan log runner.
    earnings            Ringkasan pendapatan RUB yang sudah tercatat.
    estimate            Estimasi pendapatan RUB untuk beberapa hari ke depan.
    doctor              Cek kondisi binary, config, service, dan network.
    health              Cek kesehatan runner, stale state, dan log terakhir.
    version             Tampilkan versi SeoTask yang sedang dipakai.
    update              Update binary SeoTask dari GitHub Release terbaru.
    uninstall           Hapus SeoTask, service, dan semua config lokal.

options:
  -h, --help            show this help message and exit`);
}

function printVersionHelp() {
  console.log(`usage: seotask version [-h]

options:
  -h, --help  show this help message and exit`);
}

function printLoginHelp() {
  console.log(`usage: seotask login [-h] [--email EMAIL --password PASSWORD | --cookie COOKIE | --cookie-file FILE]

options:
  -h, --help              show this help message and exit
  --email EMAIL           Email akun SeoTask. Login akan meminta CAPTCHA jika
                          server menampilkannya.
  --password PASSWORD     Password akun SeoTask.
  --cookie COOKIE         Import cookie session dari WebView/browser.
  --cookie-file FILE      Import cookie dari file Netscape atau header Cookie.
  --domain DOMAIN         Domain cookie session. Default: seo-task.com
  --user-agent USER_AGENT Override User-Agent session.
  --x-requested-with X_REQUESTED_WITH
                          Override X-Requested-With session.
  --app-package APP_PACKAGE
                          Override app package session.
  --app-version APP_VERSION
                          Override X-App-Version session.
  --device-id DEVICE_ID   Override X-Device-Id session.
  --app-token APP_TOKEN   Override X-App-Token session.`);
}

function printCredsHelp() {
  console.log(`usage: seotask creds [-h] [{status}]

positional arguments:
  {status}    Gunakan \`status\` untuk melihat credentials tersimpan.

options:
  -h, --help  show this help message and exit`);
}

function printFingerprintHelp() {
  console.log(`usage: seotask fingerprint [-h] {init,show,presets,reset}
                         [--random] [--preset PRESET] [--device DEVICE]
                         [--force] [--yes]

positional arguments:
  {init,show,presets,reset}
              init: buat fingerprint unik per VPS.
              show: tampilkan fingerprint tersimpan.
              presets: tampilkan daftar preset.
              reset: hapus fingerprint tersimpan.

options:
  -h, --help       show this help message and exit
  --random         Pilih preset random dan buat device_id baru.
  --preset PRESET  Gunakan preset tertentu.
  --device DEVICE  Buat fingerprint dari nama device custom.
  --force          Izinkan init menimpa fingerprint lama.
  --yes            Simpan tanpa prompt konfirmasi.`);
}

function printTelegramHelp() {
  console.log(`usage: seotask telegram [-h] {setup,status,test,send,disable,enable}
                        [--bot-token BOT_TOKEN] [--chat-id CHAT_ID]
                        [--time HH:MM] [--timezone TIMEZONE] [--test]

positional arguments:
  {setup,status,test,send,disable,enable}
              setup: setup BOT_TOKEN, CHAT_ID, dan jadwal report.
              status: tampilkan status config dan scheduler.
              test: kirim pesan test Telegram.
              send: kirim laporan earnings harian sekarang.
              disable: nonaktifkan notifikasi dan scheduler.
              enable: aktifkan kembali notifikasi dan scheduler.

options:
  -h, --help             show this help message and exit
  --bot-token BOT_TOKEN  Token bot Telegram.
  --chat-id CHAT_ID      Chat ID tujuan.
  --time HH:MM           Jadwal harian. Default: 06:00
  --timezone TIMEZONE    Timezone jadwal. Default: Asia/Jakarta
  --test                 Kirim pesan test setelah setup.`);
}

function printStatusHelp() {
  console.log(`usage: seotask status [-h] [-v]

options:
  -h, --help     show this help message and exit
  -v, --verbose  Tampilkan detail header dan cuplikan halaman.`);
}

function printStartHelp() {
  console.log(`usage: seotask start [-h] [--max-tasks MAX_TASKS]
                     [--poll-interval POLL_INTERVAL]
                     [--post-task-delay POST_TASK_DELAY] [--timeout TIMEOUT]
                     [--skip-up-data] [--no-youtube-touch]
                     [--youtube-cookie-file YOUTUBE_COOKIE_FILE]
                     [--domain DOMAIN] [--user-agent USER_AGENT]
                     [--x-requested-with X_REQUESTED_WITH]
                     [--app-package APP_PACKAGE] [--app-version APP_VERSION]
                     [--device-id DEVICE_ID] [--app-token APP_TOKEN] [-v]

options:
  -h, --help            show this help message and exit
  --max-tasks MAX_TASKS
                        Batas jumlah task diproses. 0 = tanpa batas.
  --poll-interval POLL_INTERVAL
                        Jeda detik saat belum ada task. Default: 20
  --post-task-delay POST_TASK_DELAY
                        Jeda detik setelah complete_task. Default: 2
  --timeout TIMEOUT     Timeout request HTTP (detik). Default: 30
  --skip-up-data        Lewati request up_data sebelum get_task.
  --no-youtube-touch    Jangan touch URL YouTube di background.
  --youtube-cookie-file YOUTUBE_COOKIE_FILE
                        File cookie YouTube (opsional) untuk request touch
                        URL.
  --domain DOMAIN       Domain cookie session. Default: seo-task.com
  --user-agent USER_AGENT
                        Override User-Agent runtime.
  --x-requested-with X_REQUESTED_WITH
                        Override X-Requested-With runtime.
  --app-package APP_PACKAGE
                        Override app package runtime.
  --app-version APP_VERSION
                        Override X-App-Version runtime.
  --device-id DEVICE_ID
                        Override X-Device-Id runtime.
  --app-token APP_TOKEN
                        Override X-App-Token runtime.
  -v, --verbose         Tampilkan detail request/proses task.`);
}

function printStopHelp() {
  console.log(`usage: seotask stop [-h]

options:
  -h, --help  show this help message and exit`);
}

function printServiceHelp() {
  console.log(`usage: seotask service [-h] {install,start,stop,restart,status,uninstall}

positional arguments:
  {install,start,stop,restart,status,uninstall}
                        Aksi service.

options:
  -h, --help            show this help message and exit`);
}

function printLogHelp() {
  console.log(`usage: seotask log [-h] [{live,clear}]

positional arguments:
  {live,clear}
             live: tampilkan log live dengan countdown task aktif.
             clear: kosongkan file log lokal.

options:
  -h, --help  show this help message and exit`);
}

function printEarningsHelp() {
  console.log(`usage: seotask earnings [-h]

options:
  -h, --help  show this help message and exit`);
}

function printEstimateHelp() {
  console.log(`usage: seotask estimate [-h] DAYS

positional arguments:
  DAYS        Jumlah hari estimasi. Minimal 7.

options:
  -h, --help  show this help message and exit`);
}

function printDoctorHelp() {
  console.log(`usage: seotask doctor [-h]

options:
  -h, --help  show this help message and exit`);
}

function printHealthHelp() {
  console.log(`usage: seotask health [-h]

options:
  -h, --help  show this help message and exit`);
}

function printUpdateHelp() {
  console.log(`usage: seotask update [-h] [--yes]

options:
  -h, --help  show this help message and exit
  --yes       Jalankan update tanpa prompt konfirmasi.`);
}

function printUninstallHelp() {
  console.log(`usage: seotask uninstall [-h]

options:
  -h, --help  show this help message and exit`);
}

module.exports = {
  printRootHelp,
  printVersionHelp,
  printLoginHelp,
  printCredsHelp,
  printFingerprintHelp,
  printTelegramHelp,
  printStatusHelp,
  printStartHelp,
  printStopHelp,
  printServiceHelp,
  printLogHelp,
  printEarningsHelp,
  printEstimateHelp,
  printDoctorHelp,
  printHealthHelp,
  printUpdateHelp,
  printUninstallHelp,
};