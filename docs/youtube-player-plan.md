# SeoTask YouTube Player Plan

Tanggal: 2026-06-13

Dokumen ini menyimpan arah adaptasi player YouTube untuk SeoTask CLI. Tujuan utamanya: task YouTube tidak hanya di-touch via HTTP, tetapi bisa benar-benar dibuka dan diputar oleh engine browser headless yang ringan untuk VPS 1 Core 1 GB.

## Keputusan Desain

- Command `seotask start` tetap sederhana dan tidak diubah menjadi command pilihan engine.
- Player dibuat sebagai command terpisah: `seotask player`.
- Default player adalah mode lama: `seotask player touch`.
- Command `seotask player ...` hanya menentukan konfigurasi engine.
- Command `seotask start` tetap menjalankan task dan memakai engine yang tersimpan.
- Command `seotask stop` tetap menghentikan runner; jika engine browser sedang aktif, proses engine juga harus dihentikan.
- Bundled engine diekstrak ke folder config aplikasi SeoTask agar `seotask uninstall` membersihkannya otomatis.
- Engine lain disediakan sebagai subcommand:
  - `seotask player touch`
  - `seotask player chromium`
  - `seotask player lightpanda`
- Prioritas riset adalah Lightpanda, idealnya bisa dibundel bersama binary `seotask` supaya tidak bergantung pada browser eksternal.

## Alur Target

Runner tetap menjalankan alur inti SeoTask:

1. `up_data`
2. `get_task`
3. simpan state task
4. player membuka task YouTube sesuai engine yang dipilih
5. countdown
6. `complete_task`

Payload dan endpoint SeoTask tidak boleh berubah kecuali ada bukti dari decompile APK.

## User-Agent Policy

Ada dua User-Agent berbeda yang harus dijaga:

1. User-Agent untuk komunikasi dengan server SeoTask.
2. User-Agent untuk engine browser/player saat membuka YouTube.

User-Agent server SeoTask tetap wajib memakai suffix aplikasi:

```text
SeoTask-App/1.0
```

Suffix ini dibutuhkan oleh komunikasi webphone/API SeoTask. Jangan dihapus dari request SeoTask seperti `webphone`, `up_data`, `get_task`, `complete_task`, `ignor_task`, dan login.

User-Agent browser/player harus diambil dari fingerprint, tetapi suffix `SeoTask-App/1.0` harus dihapus sebelum dipakai engine browser. Tujuannya agar engine yang membuka YouTube terlihat sebagai browser Android normal, bukan WebView/aplikasi SeoTask.

Contoh:

```text
Server SeoTask:
Mozilla/5.0 (...) Mobile Safari/537.36 SeoTask-App/1.0

Browser/player:
Mozilla/5.0 (...) Mobile Safari/537.36
```

Implementasi yang direncanakan:

- Tambah helper, misalnya `browserUserAgentFromProfile(profile)`.
- Helper ini mengambil `profile.user_agent`.
- Helper menghapus suffix `SeoTask-App/1.0` dan merapikan spasi.
- Runner/server SeoTask tetap memakai `profile.user_agent` asli.
- Engine `chromium` dan `lightpanda` hanya boleh memakai browser UA yang sudah dibersihkan.

## Command Player

Usulan CLI:

```text
seotask player
seotask player touch
seotask player chromium
seotask player lightpanda
seotask player status
seotask player test URL
```

Perilaku:

- `seotask player` sama dengan `seotask player touch`.
- `touch` memakai mekanisme saat ini: request ringan ke URL YouTube.
- `chromium` menjadi baseline karena sudah ada contoh dari SeoFast.
- `lightpanda` menjadi target utama jika terbukti bisa memutar YouTube secara valid.
- `status` menampilkan engine aktif/konfigurasi player.
- `test URL` dipakai untuk menguji playback tanpa menjalankan task SeoTask penuh.

## Struktur Modul

Rencana file:

```text
src/player/index.js
src/player/touch.js
src/player/chromium.js
src/player/lightpanda.js
src/player/player-server.js
src/player/youtube.js
src/commands/player.js
src/ui/player.html
```

Interface minimal engine:

```js
await player.start()
await player.play(url, meta)
await player.update(meta)
await player.clear(meta)
await player.stop()
```

Runner cukup memanggil interface ini. Detail Chromium atau Lightpanda tidak masuk langsung ke `runner.js`.

Catatan penting:

- `profile.user_agent` asli tetap milik layer SeoTask.
- Engine player menerima `browserUserAgent`, bukan `profile.user_agent` mentah.
- Ini mencegah suffix `SeoTask-App/1.0` bocor ke request YouTube.

## Referensi SeoFast

File referensi:

- `/root/Tutorial/VPS/app/workspace/seofast-project/v1.1.1/seofast-chromium-cli/src/ui/player.html`
- `/root/Tutorial/VPS/app/workspace/seofast-project/v1.1.1/seofast-chromium-cli/src/browser/player-server.js`
- `/root/Tutorial/VPS/app/workspace/seofast-project/v1.1.1/seofast-chromium-cli/src/browser/youtube.js`
- `/root/Tutorial/VPS/app/workspace/seofast-project/v1.1.1/seofast-chromium-cli/src/browser/chromium.js`

Bagian yang diadaptasi:

- local player server
- state endpoint `/state`
- parser YouTube URL ke embed URL
- `player.html` kecil untuk iframe YouTube
- state task: `status`, `sourceUrl`, `embedUrl`, `videoId`, `idStatus`, `timer`, `startedAt`, `reward`, `balance`

## Riset Lightpanda

Sumber resmi:

- https://lightpanda.io/
- https://lightpanda.io/docs/quickstart
- https://lightpanda.io/docs/run-locally/installation/one-liner
- https://lightpanda.io/docs/run-locally/installation/system-requirements
- https://lightpanda.io/docs/run-locally/commands/serve
- https://github.com/lightpanda-io/browser

Temuan:

- Lightpanda dibuat untuk automation/headless, bukan browser manusia.
- Bisa menjalankan JavaScript, DOM, Ajax, Fetch, cookies, custom headers, proxy, dan CDP server.
- Bisa dikontrol dengan Puppeteer atau Playwright melalui CDP.
- Paket Node resmi tersedia: `@lightpanda/browser`.
- Bisa berjalan lokal via `lightpanda.serve({ host, port })`.
- Bisa juga berjalan sebagai binary eksternal: `lightpanda serve --host 127.0.0.1 --port 9222`.
- Mendukung Debian 12, Ubuntu 22.04, Ubuntu 24.04 pada x86-64 dan arm64.
- Installer one-liner butuh `curl`, `jq`, dan `sha256sum`.
- Telemetry default aktif; bisa dimatikan dengan `LIGHTPANDA_DISABLE_TELEMETRY=true`.
- Status project masih beta/work in progress.
- Lightpanda tidak memakai Chromium/Blink/WebKit dan tidak punya graphical rendering engine.

Kesimpulan sementara:

Lightpanda sangat menarik untuk VPS kecil, tetapi YouTube playback belum boleh diasumsikan berhasil. Karena tidak ada graphical rendering engine, kita harus membuktikan apakah iframe YouTube, IFrame API, timer playback, dan request media benar-benar berjalan.

## Strategi Bundling Lightpanda

Target ideal:

- Binary `seotask` membawa atau bisa menyiapkan Lightpanda tanpa install browser besar.

Opsi yang perlu diuji:

1. Pakai package `@lightpanda/browser`
   - Pro: bisa dikontrol dari Node.
   - Risiko: kompatibilitas dengan `pkg` belum pasti.

2. Bundel binary Lightpanda sebagai asset tambahan
   - Pro: tidak perlu Chromium eksternal.
   - Risiko: ukuran release bertambah dan perlu asset per arsitektur.

3. Download Lightpanda saat setup player
   - Pro: binary `seotask` tetap kecil.
   - Risiko: tetap butuh koneksi dan dependency install.

Prioritas uji:

1. Uji binary eksternal Lightpanda dulu di VPS.
2. Jika playback valid, uji apakah bisa dibundel atau diunduh otomatis.
3. Jika `pkg` tidak cocok dengan `@lightpanda/browser`, gunakan strategi asset binary per arsitektur.

### Hasil Uji Bundling 2026-06-13

VPS test:

- OS: Ubuntu 24.04 x86_64.
- Node: v24.16.0.
- Package: `@lightpanda/browser@1.3.1`.

Temuan package:

- `@lightpanda/browser` hanya membawa wrapper JavaScript.
- Saat `npm install`, postinstall mengunduh executable ke:

```text
~/.cache/lightpanda-node/lightpanda
```

- Package menyatakan engine Node `22.16`, sedangkan Node 24 hanya memberi warning `EBADENGINE`; runtime dasar tetap bisa berjalan.
- Binary Lightpanda x86_64 Linux yang diunduh berukuran sekitar `122M`.

Hasil runtime:

- `lightpanda.fetch("https://example.com")` berhasil.
- `lightpanda.serve({ host: "127.0.0.1", port: 9333 })` berhasil.
- `puppeteer-core` berhasil connect ke CDP `Lightpanda/1.0`.
- `page.goto("https://example.com")` via CDP berhasil dan title terbaca `Example Domain`.

Hasil `pkg`:

- Dynamic `import("@lightpanda/browser")` di binary `pkg` gagal dengan error:

```text
TypeError: Invalid host defined options
```

- CommonJS direct entry berhasil:

```js
require("@lightpanda/browser/dist/index.cjs")
```

- Binary `pkg` dengan CommonJS entry berhasil jika executable Lightpanda sudah ada di `~/.cache/lightpanda-node/lightpanda`.
- Binary `pkg` gagal jika `HOME` kosong dan cache executable tidak ada.
- Strategi asset berhasil:
  - executable Lightpanda dimasukkan sebagai asset `pkg`.
  - saat runtime asset diekstrak ke `/tmp`.
  - `LIGHTPANDA_EXECUTABLE_PATH` diarahkan ke file hasil ekstrak.
  - test tetap berhasil walaupun `HOME` kosong.

Kesimpulan bundling:

- Lightpanda bisa dibundel bersama `seotask`, tetapi bukan hanya dengan menambahkan dependency `@lightpanda/browser`.
- Strategi yang valid adalah membawa executable Lightpanda sebagai asset per arsitektur, lalu mengekstraknya ke runtime temp path.
- Karena executable x86_64 sekitar `122M`, ukuran release `seotask-linux-amd64` bisa naik dari sekitar `45M` menjadi sekitar `166M`.
- Untuk release multi-arch, perlu executable Lightpanda x86_64 dan arm64 yang sesuai.
- Implementasi `seotask player lightpanda` sebaiknya memakai CommonJS entry `@lightpanda/browser/dist/index.cjs`, bukan dynamic ESM import.

Update implementasi:

- Runtime extraction path tidak memakai `/tmp`.
- Executable Lightpanda diekstrak ke:

```text
<SEOTASK_HOME atau ~/.config/seotask-cli>/engines/lightpanda/<arch>/lightpanda
```

- Karena `seotask uninstall` menghapus `configDir()`, executable hasil ekstraksi ikut terhapus.
- Build script memakai env berikut untuk membawa bundled Lightpanda:

```text
BUNDLE_LIGHTPANDA=1
LIGHTPANDA_BIN_X64=/path/to/lightpanda-x64
LIGHTPANDA_BIN_ARM64=/path/to/lightpanda-arm64
```

- Jika `LIGHTPANDA_BIN_X64` tidak diset dan build berjalan di x64, build script memakai cache default:

```text
~/.cache/lightpanda-node/lightpanda
```

- Build test x64 dengan bundled Lightpanda berhasil.
- Binary test berukuran sekitar `211M`.
- Test dengan `HOME` kosong berhasil; ini membuktikan runtime tidak bergantung pada cache `~/.cache/lightpanda-node`.
- Binary mengekstrak executable ke `SEOTASK_HOME/engines/lightpanda/linux-x64/lightpanda`.

## Acceptance Test Lightpanda

Lightpanda dianggap layak jika:

- `seotask player test URL --engine lightpanda` bisa membuka local player.
- iframe YouTube berhasil dimuat.
- command `playVideo` diterima.
- status player menjadi playing atau waktu video bertambah.
- network request ke media YouTube muncul, misalnya `googlevideo.com` atau `videoplayback`.
- 3 task SeoTask berturut-turut berhasil `complete_task`.
- Peak RAM jauh lebih rendah dari Chromium di VPS 1 Core 1 GB.
- Tidak crash selama minimal 30 menit runner aktif.

## Fase Kerja

### Fase 1 - Command dan Framework Player

- Tambah command `seotask player`.
- Tambah `touch` sebagai default.
- Tambah factory player.
- Tambah `player status` dan `player test URL`.
- Belum mengubah default service/start.

### Fase 2 - Adaptasi UI Player SeoFast

- Tambah `src/ui/player.html`.
- Tambah `player-server`.
- Tambah parser YouTube URL.
- Pastikan bisa dites tanpa engine berat.

### Fase 3 - Chromium Baseline

- Adaptasi Chromium player dari SeoFast.
- Dipakai sebagai pembanding, bukan target default.
- Catat RAM/CPU saat 3 task.

### Fase 4 - Lightpanda Prototype

- Uji binary eksternal Lightpanda.
- Uji CDP via Puppeteer/Playwright core.
- Uji YouTube iframe dan playback signal.
- Jika valid, lanjut riset bundling.

### Fase 5 - Integrasi ke Runner

- Runner memilih player dari konfigurasi command `seotask player`.
- `seotask start` tetap simple.
- Jika player gagal, log harus jelas dan fallback tergantung konfigurasi.

### Fase 6 - Keputusan Release

- Jika Lightpanda stabil: jadikan engine rekomendasi.
- Jika Lightpanda tidak valid untuk YouTube: tetap simpan sebagai experimental atau batalkan.
- Jika Chromium terlalu berat: jangan dijadikan default.

## Risiko

- YouTube tidak menghitung playback jika engine tidak mendukung media/rendering.
- Lightpanda beta bisa crash pada halaman YouTube.
- Bundling Lightpanda ke `pkg` mungkin tidak langsung bisa.
- Release multi-arch bisa lebih kompleks jika membawa binary Lightpanda.
- VPS 1 GB tetap bisa limit jika engine menyimpan cache atau process terlalu lama.
