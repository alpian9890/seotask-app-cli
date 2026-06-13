"use strict";

// ─── Help printers ───────────────────────────────────────────────────────────
function printRootHelp() {
  console.log(`usage: seotask [-h] {login,creds,credentials,gmail,fingerprint,telegram,player,devtools,status,start,stop,service,log,earnings,estimate,doctor,health,version,update,uninstall} ...

CLI ringkas SeoTask: login, creds, gmail, fingerprint, telegram, player, devtools, status, start, stop, service, log, earnings, estimate, doctor, health, version, update, uninstall.

positional arguments:
  {login,creds,credentials,gmail,fingerprint,telegram,player,devtools,status,start,stop,service,log,earnings,estimate,doctor,health,version,update,uninstall}
    login               Login akun menggunakan email/password atau cookie.
    creds (credentials)
                        Setup credentials untuk auto relogin (atau cek status
                        credentials).
    gmail               Setup google_email @gmail.com untuk payload Android
                        device.
    fingerprint         Kelola fingerprint Android unik per VPS.
    telegram            Kelola notifikasi earnings harian via Telegram.
    player              Kelola engine player YouTube untuk task.
    devtools            Kelola akses CDP/DevTools untuk engine browser.
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
  tanpa argumen           Pakai credentials tersimpan jika ada, atau prompt
                          EMAIL/PASSWORD jika belum ada.
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

function printGmailHelp() {
  console.log(`usage: seotask gmail [-h] [{status}]

positional arguments:
  {status}    Gunakan \`status\` untuk melihat google_email yang dipakai.

Tanpa argumen, command ini akan menawarkan penggunaan email login SeoTask
jika alamatnya @gmail.com, atau meminta input alamat @gmail.com lain.

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
                        [--login-topic URL]
                        [--login-chat-id CHAT_ID --login-thread-id ID]
                        [--earnings-topic URL]
                        [--earnings-chat-id CHAT_ID --earnings-thread-id ID]
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
  --chat-id CHAT_ID      Chat ID default tujuan.
  --login-topic URL      Link topic login, contoh:
                         https://t.me/c/4305132504/2
  --login-chat-id CHAT_ID
                         CHAT_ID manual untuk notifikasi login.
  --login-thread-id ID   THREAD_ID manual untuk notifikasi login.
  --earnings-topic URL   Link topic earnings, contoh:
                         https://t.me/c/4305132504/7
  --earnings-chat-id CHAT_ID
                         CHAT_ID manual untuk notifikasi earnings.
  --earnings-thread-id ID
                         THREAD_ID manual untuk notifikasi earnings.
  --time HH:MM           Jadwal harian. Default: 06:00
  --timezone TIMEZONE    Timezone jadwal. Default: Asia/Jakarta
  --test                 Kirim pesan test setelah setup.

Saat setup interaktif, kamu bisa memilih paste link topic, isi manual,
atau setup nanti untuk notifikasi login dan earnings.`);
}

function printPlayerHelp() {
  console.log(`usage: seotask player [-h] {touch,chromium,lightpanda,none,status,test}
                      [URL] [--engine ENGINE] [--host HOST] [--port PORT]
                      [--timeout SECONDS] [--browser-path PATH]
                      [--cdp-host HOST] [--cdp-port PORT]
                      [--user-data-dir DIR] [--cookie-file FILE]
                      [--timer SECONDS]

positional arguments:
  {touch,chromium,lightpanda,none,status,test}
              touch: aktifkan mode touch URL YouTube sebagai default stabil.
              chromium: pilih engine Chromium untuk eksperimen berikutnya.
              lightpanda: pilih engine Lightpanda untuk eksperimen berikutnya.
              none: nonaktifkan player/touch YouTube.
              status: tampilkan config player aktif.
              test: test URL YouTube dengan engine aktif atau --engine.
  URL         URL YouTube untuk action test.

options:
  -h, --help          show this help message and exit
  --engine ENGINE     Engine untuk test: touch, chromium, lightpanda, none.
  --host HOST         Host local player server. Default: 127.0.0.1
  --port PORT         Port local player server. 0 = random.
  --timeout SECONDS   Timeout player/request. Default: 30
  --browser-path PATH Path browser eksternal untuk engine browser.
  --cdp-host HOST     Host CDP eksternal/Lightpanda.
  --cdp-port PORT     Port CDP eksternal/Lightpanda.
  --user-data-dir DIR Direktori profil browser.
  --cookie-file FILE  Cookie YouTube untuk mode touch/test.
  --timer SECONDS     Timer simulasi untuk test. Default: 30

Tanpa argumen, \`seotask player\` sama dengan \`seotask player touch\`.
User-Agent player memakai fingerprint tanpa suffix SeoTask-App/1.0.`);
}

function printDevtoolsHelp() {
  console.log(`usage: seotask devtools [-h] {status,off,local,public,frontend,url}
                         [--port PORT] [--host HOST] [--bind ADDRESS]

positional arguments:
  {status,off,local,public,frontend,url}
              status: tampilkan konfigurasi DevTools saat ini.
              off: matikan remote debugging untuk start berikutnya.
              local: aktifkan DevTools di 127.0.0.1 untuk SSH port
                     forwarding.
              public: aktifkan DevTools di 0.0.0.0 agar bisa diakses via
                      IP:PORT publik jika firewall mengizinkan.
              frontend: seperti public, tetapi fokus ke URL
                        chrome-devtools-frontend.appspot.com.
              url: tampilkan URL frontend untuk browser yang sedang berjalan.

options:
  -h, --help      show this help message and exit
  --port PORT     Port DevTools. Default: 9222
  --host HOST     Host/IP yang ditampilkan untuk akses publik/frontend.
  --bind ADDRESS  Bind address DevTools. Default local=127.0.0.1,
                  public/frontend=0.0.0.0

Mode local paling aman: jalankan \`ssh -L PORT:127.0.0.1:PORT node2\`,
lalu buka http://127.0.0.1:PORT saat runner/player aktif.`);
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
  printGmailHelp,
  printFingerprintHelp,
  printTelegramHelp,
  printPlayerHelp,
  printDevtoolsHelp,
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
