# CoffeeScope

**Eksplorasi penjualan minuman sesuai tujuan analisismu.**

CoffeeScope adalah dashboard analisis penjualan minuman berbasis browser yang dirancang untuk operator mesin penjual minuman dan pemilik usaha kecil. Dashboard ini membantu pengguna mengeksplorasi tren penjualan, popularitas minuman, jam transaksi, dan metode pembayaran—sesuai dengan tujuan analisis yang mereka tentukan sendiri.

---

## Tujuan dan Target Pengguna

| Pengguna | Kegunaan |
|---|---|
| Operator mesin penjual minuman | Memantau tren harian/mingguan, jam tersibuk, dan perbandingan metode pembayaran |
| Pemilik usaha kecil | Mengevaluasi kinerja periode tertentu terhadap target penjualan sendiri |
| Analis data pemula | Mengeksplorasi distribusi produk dan pola transaksi historis |

---

## Cara Menjalankan

### Cara 1 — Live Server (disarankan, pemuatan otomatis)

1. Pastikan `index_1.csv` berada di folder proyek yang sama dengan `index.html`.
2. Buka folder proyek dengan **VS Code**, lalu klik **Go Live** (ekstensi Live Server) — atau jalankan server HTTP lain dari folder yang sama.
3. Browser akan membuka `http://127.0.0.1:5500/` (port default Live Server).
4. Dashboard memuat `index_1.csv` secara otomatis saat halaman dibuka, tanpa tindakan tambahan.

> **Ekstensi Live Server untuk VS Code:** [ritwickdey.liveserver](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
>
> Alternatif lain: `python -m http.server 5500` atau ekstensi serupa di editor lain.

### Cara 2 — Buka CSV manual (tanpa server)

1. Buka `index.html` langsung di browser (double-click atau `File → Open`).
2. Karena protokol `file://` tidak mendukung `fetch`, pemuatan otomatis tidak akan berjalan dan pesan petunjuk akan ditampilkan.
3. Klik tombol **☕ Buka CSV** di pojok kanan atas.
4. Pilih file `index_1.csv` dari komputer Anda.
5. Dashboard akan dimuat dengan seluruh rentang data sebagai default.

> Tombol **Buka CSV** juga berfungsi saat menggunakan Live Server — gunakan untuk mengganti dataset ke file CSV lain kapan saja.

---

## Kolom Dataset

| Kolom | Keterangan |
|---|---|
| `date` | Tanggal transaksi (format `YYYY-MM-DD`) |
| `datetime` | Tanggal dan waktu transaksi lengkap (`YYYY-MM-DD HH:MM:SS.mmm`) |
| `cash_type` | Metode pembayaran (`card` atau `cash`) |
| `card` | Nomor anonim kartu (tidak ditampilkan di dashboard) |
| `money` | Nilai transaksi dalam satuan moneter dataset |
| `coffee_name` | Nama minuman yang dibeli |

**Sumber dataset:** [Kaggle — Coffee Sales (ihelon)](https://www.kaggle.com/datasets/ihelon/coffee-sales)

---

## Rumus KPI

| KPI | Rumus |
|---|---|
| Total Nilai Penjualan | `SUM(money)` untuk semua baris terfilter |
| Jumlah Transaksi | Jumlah baris valid setelah filter diterapkan |
| Rata-rata Nilai Transaksi | `SUM(money) / Jumlah Transaksi` |
| Jenis Minuman | Jumlah nilai unik `coffee_name` setelah filter |

Penjumlahan menggunakan aritmetika bilangan bulat (perseratus/cents) untuk mengurangi kesalahan floating point.

> **Catatan mata uang:** Satuan moneter dataset belum terverifikasi. Dashboard tidak menggunakan simbol mata uang apa pun.

---

## Filter yang Tersedia

| Filter | Fungsi |
|---|---|
| Tanggal Mulai & Akhir | Membatasi rentang tanggal (inklusif di kedua ujung) |
| Jenis Minuman | Saring berdasarkan nama minuman; default "Semua Minuman" |
| Metode Pembayaran | Saring berdasarkan cash/card; default "Semua Pembayaran" |
| Metrik Grafik | Tampilkan grafik berdasarkan Nilai Penjualan atau Jumlah Transaksi |
| Pengelompokan Tren | Harian, Mingguan (mulai Senin), atau Bulanan |
| Top N Minuman | Batasi grafik peringkat ke Top 3, Top 5, atau Semua |
| Target | Nilai positif opsional untuk evaluasi pencapaian |

Tombol **↺ Reset Filter** mengembalikan semua filter ke nilai default:
- Seluruh periode data
- Semua minuman dan semua pembayaran
- Metrik: Nilai Penjualan
- Pengelompokan: Bulanan
- Top N: 5
- Target: dikosongkan

---

## Pengelompokan Waktu

| Mode | Perilaku |
|---|---|
| Harian | Satu titik per hari |
| Mingguan | Satu titik per pekan (Senin–Minggu); label ditampilkan sebagai rentang tanggal |
| Bulanan | Satu titik per bulan (`YYYY-MM`) |

Kelompok waktu yang hanya sebagian tercakup oleh rentang filter (misalnya bulan tidak lengkap) ditandai dengan **⚑** di grafik dan label "Periode parsial" pada legenda.

---

## Target Opsional

- Isi kolom **Target** dengan angka positif.
- Pilih apakah target berlaku untuk **Nilai Penjualan** atau **Jumlah Transaksi**.
- Dashboard menampilkan: aktual, target, persentase pencapaian, dan selisih (kelebihan atau kekurangan).
- Persentase pencapaian boleh melebihi 100%.
- Target dievaluasi terhadap data historis terfilter; bukan prediksi ke depan.
- Kosongkan kolom target untuk menyembunyikan bagian evaluasi.

---

## Contoh Penggunaan

**Skenario:** Saya ingin melihat 3 minuman paling laris berdasarkan jumlah transaksi selama bulan Maret 2024, dan mengevaluasi apakah target 100 transaksi tercapai.

1. Buka `index.html` → klik **Buka CSV** → pilih `index_1.csv`.
2. Atur **Tanggal Mulai** = `2024-03-01` dan **Tanggal Akhir** = `2024-03-31`.
3. Biarkan filter minuman dan pembayaran pada "Semua".
4. Ubah **Metrik Grafik** ke **Jumlah Transaksi**.
5. Ubah **Top N Minuman** ke **Top 3**.
6. Isi **Target** dengan `100` dan pilih **Jumlah Transaksi**.
7. Lihat grafik Peringkat Minuman untuk top 3, dan bagian **Evaluasi Target** untuk pencapaian.

---

## Batasan

- **Data historis saja:** Dashboard hanya menganalisis transaksi yang ada di CSV; tidak ada prediksi atau rekomendasi otomatis.
- **Mata uang belum diverifikasi:** Nilai `money` ditampilkan apa adanya tanpa simbol mata uang.
- **Tidak ada data biaya, stok, atau kuantitas:** Dataset hanya mencatat nilai transaksi per baris.
- **Tidak ada data pelanggan unik:** Jumlah baris bukan jumlah pelanggan unik atau unit terjual.
- **Tidak ada order ID:** Setiap baris dianggap sebagai satu transaksi terpisah.
- **Tidak ada perhitungan laba:** Informasi biaya tidak tersedia di dataset.

---

## Teknologi

- HTML5, CSS3, dan vanilla JavaScript — tanpa framework, CDN, atau dependensi eksternal.
- Semua perhitungan berjalan lokal di browser menggunakan JavaScript.
- File tidak dikirim ke server mana pun.
- **IBM Bob** (AI assistant) digunakan untuk membantu penulisan kode; dashboard tidak menggunakan LLM atau API saat dijalankan.

---

## Langkah Pengujian Manual

1. **Muat CSV** → pastikan status "Berhasil memuat N transaksi" muncul.
2. **Filter tanggal** → atur rentang sempit (misal 1 hari) → verifikasi KPI, grafik, dan tabel berubah konsisten.
3. **Filter minuman** → pilih satu minuman → pastikan grafik peringkat hanya menampilkan minuman tersebut dan KPI "Jenis Minuman" = 1.
4. **Filter pembayaran** → pilih "Cash" → verifikasi grafik pembayaran hanya menampilkan Cash.
5. **Tanggal terbalik** → atur Tanggal Mulai > Tanggal Akhir → pastikan pesan error muncul, bukan hasil menyesatkan.
6. **Filter kosong** → atur filter sehingga tidak ada transaksi cocok → pastikan KPI menampilkan 0, grafik kosong, dan tabel menampilkan "Tidak ada transaksi ditemukan."
7. **Target** → isi target dengan angka; verifikasi aktual, target, %, dan selisih tampil benar. Kosongkan target → bagian evaluasi hilang.
8. **Pengelompokan** → beralih antara Harian/Mingguan/Bulanan → verifikasi label tren berubah.
9. **Top N** → ganti antara 3/5/Semua → verifikasi hanya grafik peringkat yang berubah.
10. **Reset** → klik ↺ Reset Filter → semua filter kembali ke default.
11. **Pagination** → muat data penuh → navigasi antar halaman tabel.
12. **Responsif** → perkecil jendela browser → pastikan layout satu kolom dan tidak ada elemen terpotong.

---

*Proyek oleh Novita Astari Sabrina*
