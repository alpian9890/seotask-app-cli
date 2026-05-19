# SeoTask App CLI

SeoTask App CLI adalah port CLI Linux dari `seotask-1.3.3.apk`.

Target awal dibuat mengikuti logic APK terlebih dulu:

- base URL: `https://seo-task.com`
- webphone URL: `https://seo-task.com/webphone/`
- package Android: `com.example.videoload`
- app version: `1.3.3`
- binary CLI: `seotask`

## Install Cepat

Install menggunakan `curl`:

```bash
curl -fsSL https://raw.githubusercontent.com/alpian9890/seotask-app-cli/main/scripts/install.sh | sh
```

Atau menggunakan `wget`:

```bash
wget -qO- https://raw.githubusercontent.com/alpian9890/seotask-app-cli/main/scripts/install.sh | sh
```

Installer akan mendeteksi arsitektur OS secara otomatis:

- `amd64` / `x86_64`
- `arm64` / `aarch64`

Saat download binary, installer menampilkan URL, asset yang dipilih, dan progress download.

Jika systemd tersedia, installer akan menanyakan apakah SeoTask ingin dipasang sebagai service.

Saat install pertama, installer juga membuat fingerprint Android unik untuk VPS tersebut. Fingerprint akan ditampilkan di terminal dan pengguna bisa menerima atau generate ulang sebelum disimpan.

Installer juga akan menanyakan apakah preview CAPTCHA dan laporan earnings harian ingin dikirim ke Telegram. Jika dilewati, setup bisa dilakukan nanti dengan `seotask telegram setup`.

## Command

Command dibuat mengikuti pola `seofast-app-cli` selama cocok dengan flow SeoTask:

```bash
seotask fingerprint init
seotask fingerprint show
seotask login --email 'email@mail.com' --password 'password'
seotask login --cookie 'PHPSESSID=...; other=value'
seotask status
seotask start
seotask stop
seotask log
seotask health
seotask version
```

Login email/password SeoTask bisa menampilkan CAPTCHA. CLI akan menyimpan gambar CAPTCHA sementara di folder config, mengirim preview ke Telegram jika `seotask telegram setup` sudah dikonfigurasi, menampilkan pertanyaan, lalu meminta nomor pilihan yang sesuai.

## Development Lokal

```bash
npm ci
npm run check
node src/seotask.js --help
```

## Build Binary

Build satu arsitektur:

```bash
npm run build:arm64
npm run build:amd64
```

Build dua arsitektur untuk release:

```bash
npm run build:release
```

Output release:

```text
release/seotask-linux-arm64
release/seotask-linux-amd64
```

## Alur VPS

Kode diedit dan commit dari lokal. Build berat bisa dilakukan di VPS `node1` atau `node2`:

```bash
git clone https://github.com/alpian9890/seotask-app-cli.git
cd seotask-app-cli
npm ci
npm run build:release
```

Setelah binary selesai, copy hasil build kembali ke lokal, lalu commit/push dari lokal.
