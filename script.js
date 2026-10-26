/**
 * CoffeeScope — script.js
 * Dashboard analisis penjualan minuman.
 * Semua perhitungan berjalan lokal di browser, tanpa API atau backend.
 */

'use strict';

/* ============================================================
   STATE
   ============================================================ */
const state = {
  allRows: [],          // semua transaksi valid setelah parsing
  filteredRows: [],     // hasil filter aktif
  minDate: '',          // YYYY-MM-DD
  maxDate: '',
  coffees: [],          // daftar unik coffee_name dari CSV
  payments: [],         // daftar unik cash_type dari CSV
  page: 1,
  pageSize: 25,
};

/* ============================================================
   DOM REFS
   ============================================================ */
const $ = id => document.getElementById(id);
const csvInput       = $('csvInput');
const csvLabel       = $('csvLabel');
const welcomePanel   = $('welcomePanel');
const loadStatus     = $('loadStatus');
const dashboard      = $('dashboard');
const infoBar        = $('infoBar');

const dateStart      = $('dateStart');
const dateEnd        = $('dateEnd');
const filterCoffee   = $('filterCoffee');
const filterPayment  = $('filterPayment');
const metricSelect   = $('metricSelect');
const groupingSelect = $('groupingSelect');
const topNSelect     = $('topNSelect');
const targetValue    = $('targetValue');
const targetMetric   = $('targetMetric');
const btnReset       = $('btnReset');
const filterSummary  = $('filterSummary');
const dateError      = $('dateError');

const kpiSalesVal    = $('kpiSalesVal');
const kpiTxVal       = $('kpiTxVal');
const kpiAvgVal      = $('kpiAvgVal');
const kpiTypesVal    = $('kpiTypesVal');

const targetSection  = $('targetSection');
const targetResult   = $('targetResult');

const chartTrend     = $('chartTrend');
const chartRank      = $('chartRank');
const chartHour      = $('chartHour');
const chartPayment   = $('chartPayment');
const tableTrend     = $('tableTrend');
const tableRank      = $('tableRank');
const tableHour      = $('tableHour');
const tablePayment   = $('tablePayment');
const trendTitle     = $('trendTitle');
const rankTitle      = $('rankTitle');

const txBody         = $('txBody');
const tableStatus    = $('tableStatus');
const pagination     = $('pagination');

/* ============================================================
   CSV PARSING
   ============================================================ */

/**
 * Parse satu baris CSV yang mendukung nilai dalam kutip dan koma di dalam nilai.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  fields.push(cur);
  return fields;
}

/**
 * Validasi apakah string tanggal memiliki format YYYY-MM-DD dan merupakan tanggal nyata.
 */
function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + 'T00:00:00');
  return !isNaN(d.getTime());
}

/**
 * Validasi waktu: HH:MM:SS(.mmm) — bagian detik/milidetik opsional.
 */
function isValidTime(str) {
  return /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str);
}

/**
 * Parse CSV text menjadi array transaksi valid.
 * Mengembalikan { rows, invalidCount, invalidReasons }.
 * @param {string} text — isi file CSV sebagai teks mentah
 */
function parseCSV(text) {
  // Hapus BOM jika ada
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  // Normalkan CRLF → LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = text.split('\n');
  if (lines.length < 2) {
    return { rows: [], invalidCount: 0, invalidReasons: ['File CSV kosong atau hanya memiliki header.'] };
  }

  // Header
  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const iDate      = header.indexOf('date');
  const iDatetime  = header.indexOf('datetime');
  const iCashType  = header.indexOf('cash_type');
  const iMoney     = header.indexOf('money');
  const iCoffee    = header.indexOf('coffee_name');

  const missingCols = [];
  if (iDate < 0) missingCols.push('date');
  if (iDatetime < 0) missingCols.push('datetime');
  if (iCashType < 0) missingCols.push('cash_type');
  if (iMoney < 0) missingCols.push('money');
  if (iCoffee < 0) missingCols.push('coffee_name');

  if (missingCols.length > 0) {
    return {
      rows: [],
      invalidCount: 0,
      invalidReasons: [`Kolom wajib tidak ditemukan: ${missingCols.join(', ')}.`]
    };
  }

  const rows = [];
  const invalidByReason = {};
  let invalidCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // abaikan baris kosong

    const fields = parseCSVLine(line);
    const dateStr     = (fields[iDate]     || '').trim();
    const datetimeStr = (fields[iDatetime] || '').trim();
    const cashType    = (fields[iCashType] || '').trim();
    const moneyStr    = (fields[iMoney]    || '').trim();
    const coffeeName  = (fields[iCoffee]   || '').trim();

    // Ekstrak waktu dari datetime (bagian setelah spasi)
    const dtParts = datetimeStr.split(' ');
    const timeStr = dtParts.length > 1 ? dtParts.slice(1).join(' ') : '';

    const errors = [];

    if (!isValidDate(dateStr))            errors.push('tanggal tidak valid');
    if (!timeStr || !isValidTime(timeStr)) errors.push('waktu tidak valid');
    if (!coffeeName)                       errors.push('nama minuman kosong');
    if (!cashType)                         errors.push('metode pembayaran kosong');

    const moneyNum = parseFloat(moneyStr);
    if (!isFinite(moneyNum) || moneyNum < 0) errors.push('nilai money tidak valid');

    if (errors.length > 0) {
      invalidCount++;
      const key = errors.join('; ');
      invalidByReason[key] = (invalidByReason[key] || 0) + 1;
      continue;
    }

    rows.push({
      date: dateStr,          // YYYY-MM-DD
      time: timeStr.slice(0, 8), // HH:MM:SS
      datetime: datetimeStr,
      cashType: cashType.toLowerCase(),
      money: moneyNum,
      coffeeName,
    });
  }

  const invalidReasons = Object.entries(invalidByReason)
    .map(([reason, count]) => `${count} baris — ${reason}`);

  return { rows, invalidCount, invalidReasons };
}

/* ============================================================
   AUTO-LOAD via fetch (Live Server / HTTP)
   ============================================================ */
async function autoLoadCSV() {
  // file:// tidak mendukung fetch — tampilkan petunjuk, biarkan Buka CSV aktif
  if (window.location.protocol === 'file:') {
    showStatus('warn',
      '⚠ Pemuatan otomatis memerlukan Live Server (HTTP). ' +
      'Klik <strong>Buka CSV</strong> untuk memilih <code>index_1.csv</code> secara manual, ' +
      'atau buka proyek melalui Live Server agar dataset dimuat otomatis.'
    );
    return;
  }

  showStatus('info', '⏳ Memuat dataset otomatis…');

  let text;
  try {
    const res = await fetch('./index_1.csv');
    if (!res.ok) {
      showStatus('error',
        `❌ Gagal mengambil <code>index_1.csv</code>: server mengembalikan status ${res.status} ${escapeHTML(res.statusText)}. ` +
        'Pastikan file ada di folder proyek, lalu coba lagi atau gunakan tombol <strong>Buka CSV</strong>.'
      );
      return;
    }
    text = await res.text();
  } catch (err) {
    showStatus('error',
      '❌ Tidak dapat mengambil <code>index_1.csv</code>: ' + escapeHTML(String(err)) + '. ' +
      'Gunakan tombol <strong>Buka CSV</strong> sebagai alternatif.'
    );
    return;
  }

  processCSVText(text, 'index_1.csv');
}

/**
 * Proses teks CSV (dari fetch maupun FileReader), jalankan validasi dan render.
 * @param {string} text  - isi file CSV
 * @param {string} label - nama file untuk ditampilkan di pesan status
 */
function processCSVText(text, label) {
  const { rows, invalidCount, invalidReasons } = parseCSV(text);

  if (rows.length === 0 && invalidReasons.length > 0) {
    showStatus('error', '❌ Gagal memuat: ' + invalidReasons.map(escapeHTML).join(' '));
    return;
  }

  let statusMsg =
    `✅ Berhasil memuat <strong>${rows.length.toLocaleString('id-ID')} transaksi valid</strong>` +
    ` dari <em>${escapeHTML(label)}</em>.`;
  let statusType = 'success';

  if (invalidCount > 0) {
    statusMsg +=
      `<br>⚠ <strong>${invalidCount} baris tidak valid</strong> dilewati: ` +
      invalidReasons.map(escapeHTML).join('; ') + '.';
    statusType = 'warn';
  }

  showStatus(statusType, statusMsg);
  loadData(rows);
}

document.addEventListener('DOMContentLoaded', autoLoadCSV);

/* ============================================================
   FILE INPUT (Buka CSV — manual / fallback)
   ============================================================ */
csvInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showStatus('error', '⚠ File harus berformat CSV.');
    return;
  }
  showStatus('info', '⏳ Membaca file…');

  const reader = new FileReader();
  reader.onload = (ev) => processCSVText(ev.target.result, file.name);
  reader.onerror = () => showStatus('error', '❌ Gagal membaca file.');
  reader.readAsText(file);

  // Reset input agar file yang sama bisa dipilih ulang
  csvInput.value = '';
});

function showStatus(type, html) {
  loadStatus.className = 'load-status ' + type;
  loadStatus.innerHTML = html;
  loadStatus.hidden = false;
}

/* ============================================================
   LOAD DATA → inisialisasi state & UI
   ============================================================ */
function loadData(rows) {
  state.allRows = rows;

  // Tentukan rentang tanggal dan kategori dari CSV
  const dates = rows.map(r => r.date).sort();
  state.minDate = dates[0];
  state.maxDate = dates[dates.length - 1];

  state.coffees  = [...new Set(rows.map(r => r.coffeeName))].sort();
  state.payments = [...new Set(rows.map(r => r.cashType))].sort();

  // Sembunyikan welcome, tampilkan dashboard
  welcomePanel.hidden = true;
  dashboard.hidden = false;

  // Isi dropdown kategori
  populateSelect(filterCoffee, state.coffees, 'Semua Minuman');
  populateSelect(filterPayment, state.payments.map(toTitleCase), 'Semua Pembayaran', state.payments);

  // Info bar dataset
  infoBar.innerHTML =
    `<span><b>Dataset:</b> ${state.minDate} — ${state.maxDate}</span>` +
    `<span><b>Total baris valid:</b> ${rows.length.toLocaleString('id-ID')}</span>` +
    `<span><b>Jenis minuman:</b> ${state.coffees.length}</span>` +
    `<span><b>Metode pembayaran:</b> ${state.payments.map(toTitleCase).join(', ')}</span>`;

  resetFilters(true);
}

function populateSelect(selectEl, labels, allLabel, values) {
  selectEl.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = allLabel;
  selectEl.appendChild(allOpt);
  labels.forEach((label, i) => {
    const opt = document.createElement('option');
    opt.value = values ? values[i] : label;
    opt.textContent = label;
    selectEl.appendChild(opt);
  });
}

/* ============================================================
   RESET
   ============================================================ */
function resetFilters(doRender = true) {
  dateStart.value       = state.minDate;
  dateEnd.value         = state.maxDate;
  filterCoffee.value    = '';
  filterPayment.value   = '';
  metricSelect.value    = 'value';
  groupingSelect.value  = 'monthly';
  topNSelect.value      = '5';
  targetValue.value     = '';
  state.page = 1;
  if (doRender) render();
}

btnReset.addEventListener('click', () => resetFilters(true));

/* ============================================================
   CONTROLS → re-render
   ============================================================ */
[dateStart, dateEnd, filterCoffee, filterPayment,
 metricSelect, groupingSelect, topNSelect].forEach(el => {
  el.addEventListener('change', () => { state.page = 1; render(); });
});
[targetValue, targetMetric].forEach(el => {
  el.addEventListener('input', () => render());
});

/* ============================================================
   FILTER
   ============================================================ */
function applyFilters() {
  const ds = dateStart.value;
  const de = dateEnd.value;
  const coffee  = filterCoffee.value;
  const payment = filterPayment.value;

  return state.allRows.filter(r => {
    if (ds && r.date < ds) return false;
    if (de && r.date > de) return false;
    if (coffee  && r.coffeeName !== coffee) return false;
    if (payment && r.cashType   !== payment) return false;
    return true;
  });
}

/* ============================================================
   MAIN RENDER
   ============================================================ */
function render() {
  const ds = dateStart.value;
  const de = dateEnd.value;

  // Validasi tanggal
  dateError.hidden = true;
  if (ds && de && ds > de) {
    dateError.textContent = '⚠ Tanggal mulai tidak boleh melewati tanggal akhir. Perbaiki sebelum melihat hasil.';
    dateError.hidden = false;
    return;
  }

  const rows = applyFilters();
  state.filteredRows = rows;

  updateFilterSummary(ds, de, rows.length);
  renderKPI(rows);
  renderTarget(rows);
  renderTrend(rows);
  renderRank(rows);
  renderHour(rows);
  renderPayment(rows);
  renderTable(rows);
}

/* ============================================================
   FILTER SUMMARY
   ============================================================ */
function updateFilterSummary(ds, de, count) {
  const metric   = metricSelect.value === 'value' ? 'Nilai Penjualan' : 'Jumlah Transaksi';
  const grouping = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' }[groupingSelect.value];
  const coffee   = filterCoffee.value   || 'Semua Minuman';
  const payment  = filterPayment.value  ? toTitleCase(filterPayment.value) : 'Semua Pembayaran';
  const topN     = topNSelect.value === 'all' ? 'Semua' : `Top ${topNSelect.value}`;
  const period   = (ds || state.minDate) + ' s.d. ' + (de || state.maxDate);

  filterSummary.textContent =
    `Periode: ${period} · Minuman: ${coffee} · Pembayaran: ${payment} · ` +
    `Metrik: ${metric} · Tren: ${grouping} · Peringkat: ${topN} · ` +
    `Hasil: ${count.toLocaleString('id-ID')} transaksi`;
}

/* ============================================================
   PERHITUNGAN DASAR (integer cents untuk presisi)
   ============================================================ */
function sumMoney(rows) {
  // Penjumlahan dalam perseratus (cents) untuk mengurangi floating point error
  let cents = 0;
  for (const r of rows) cents += Math.round(r.money * 100);
  return cents / 100;
}

function formatNum(n, decimals = 2) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/* ============================================================
   KPI
   ============================================================ */
function renderKPI(rows) {
  const total = sumMoney(rows);
  const count = rows.length;
  kpiSalesVal.textContent  = count === 0 ? '0.00' : formatNum(total);
  kpiTxVal.textContent     = count.toLocaleString('id-ID');
  kpiAvgVal.textContent    = count === 0 ? '—' : formatNum(total / count);
  kpiTypesVal.textContent  = count === 0 ? '0' : new Set(rows.map(r => r.coffeeName)).size.toString();
}

/* ============================================================
   TARGET EVALUASI
   ============================================================ */
function renderTarget(rows) {
  const rawTarget = targetValue.value.trim();
  if (!rawTarget) {
    targetSection.hidden = true;
    return;
  }
  const tgt = parseFloat(rawTarget);
  if (!isFinite(tgt) || tgt <= 0) {
    targetSection.hidden = true;
    return;
  }

  const tMetric = targetMetric.value;
  const actual = tMetric === 'value' ? sumMoney(rows) : rows.length;
  const pct    = tgt === 0 ? 0 : (actual / tgt) * 100;
  const diff   = actual - tgt;
  const over   = diff >= 0;
  const metricLabel = tMetric === 'value' ? 'Nilai Penjualan' : 'Jumlah Transaksi';
  const unit        = tMetric === 'value' ? ' (satuan moneter dataset)' : ' transaksi';

  targetResult.innerHTML = `
    <div class="target-item">
      <div class="t-label">Metrik Target</div>
      <div class="t-value">${metricLabel}</div>
    </div>
    <div class="target-item highlight">
      <div class="t-label">Aktual</div>
      <div class="t-value">${tMetric === 'value' ? formatNum(actual) : actual.toLocaleString('id-ID')}${unit}</div>
    </div>
    <div class="target-item">
      <div class="t-label">Target</div>
      <div class="t-value">${tMetric === 'value' ? formatNum(tgt) : tgt.toLocaleString('id-ID')}${unit}</div>
    </div>
    <div class="target-item highlight">
      <div class="t-label">Pencapaian</div>
      <div class="t-value">${formatNum(pct, 1)}%</div>
    </div>
    <div class="target-item ${over ? 'over' : 'under'}">
      <div class="t-label">${over ? 'Kelebihan' : 'Kekurangan'}</div>
      <div class="t-value">${tMetric === 'value' ? formatNum(Math.abs(diff)) : Math.abs(diff).toLocaleString('id-ID')}${unit}</div>
    </div>
  `;
  targetSection.hidden = false;
}

/* ============================================================
   GRAFIK TREN
   ============================================================ */
function renderTrend(rows) {
  const grouping = groupingSelect.value;
  const metric   = metricSelect.value;
  const ds = dateStart.value || state.minDate;
  const de = dateEnd.value   || state.maxDate;

  const metricLabel = metric === 'value' ? 'Nilai Penjualan' : 'Jumlah Transaksi';
  trendTitle.textContent = `Tren ${metricLabel} — ${
    { daily:'Harian', weekly:'Mingguan', monthly:'Bulanan' }[grouping]
  }`;

  if (rows.length === 0) {
    chartTrend.innerHTML = '<p class="muted" style="padding:1rem">Tidak ada data untuk ditampilkan.</p>';
    tableTrend.innerHTML = '';
    return;
  }

  // Kelompokkan baris ke dalam bucket
  const buckets = buildTimeBuckets(rows, grouping, ds, de);
  const labels  = Object.keys(buckets).sort();
  const values  = labels.map(k => {
    const bRows = buckets[k].rows;
    return metric === 'value' ? sumMoney(bRows) : bRows.length;
  });
  const partials = labels.map(k => buckets[k].partial);

  renderBarOrLineChart(chartTrend, {
    labels,
    values,
    partials,
    unit: metric === 'value' ? 'satuan moneter' : 'transaksi',
    color: '#285544',
    type: 'line',
  });

  // Tabel ringkasan
  tableTrend.innerHTML = buildSummaryTable(
    ['Periode', metricLabel, 'Parsial?'],
    labels.map((l, i) => [l, metric === 'value' ? formatNum(values[i]) : values[i].toLocaleString('id-ID'), partials[i] ? '⚑ Ya' : 'Tidak'])
  );
}

/**
 * Kelompokkan rows ke bucket berdasarkan pengelompokan waktu.
 * @returns {{ [key: string]: { rows: row[], partial: boolean } }}
 */
function buildTimeBuckets(rows, grouping, ds, de) {
  const buckets = {};

  function getBucketKey(dateStr) {
    if (grouping === 'daily') return dateStr;
    if (grouping === 'weekly') {
      const d = parseLocalDate(dateStr);
      const dow = d.getDay(); // 0=Sun
      const diff = (dow === 0 ? -6 : 1 - dow); // geser ke Senin
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return formatDate(mon) + ' — ' + formatDate(sun);
    }
    if (grouping === 'monthly') {
      return dateStr.slice(0, 7); // YYYY-MM
    }
  }

  for (const r of rows) {
    const key = getBucketKey(r.date);
    if (!buckets[key]) buckets[key] = { rows: [], partial: false };
    buckets[key].rows.push(r);
  }

  // Tandai bucket parsial: bucket yang tidak sepenuhnya tercakup oleh ds..de
  if (grouping === 'monthly') {
    for (const key of Object.keys(buckets)) {
      const firstOfMonth = key + '-01';
      const lastOfMonth  = key + '-' + lastDayOfMonth(key);
      if (ds > firstOfMonth || de < lastOfMonth) {
        buckets[key].partial = true;
      }
    }
  } else if (grouping === 'weekly') {
    for (const key of Object.keys(buckets)) {
      const parts = key.split(' — ');
      const weekStart = parts[0];
      const weekEnd   = parts[1];
      if (ds > weekStart || de < weekEnd) {
        buckets[key].partial = true;
      }
    }
  }

  return buckets;
}

function lastDayOfMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate().toString().padStart(2, '0');
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/* ============================================================
   GRAFIK PERINGKAT MINUMAN
   ============================================================ */
function renderRank(rows) {
  const metric   = metricSelect.value;
  const topNRaw  = topNSelect.value;
  const metricLabel = metric === 'value' ? 'Nilai Penjualan' : 'Jumlah Transaksi';
  rankTitle.textContent = `Peringkat Minuman — ${metricLabel}`;

  if (rows.length === 0) {
    chartRank.innerHTML = '<p class="muted" style="padding:1rem">Tidak ada data.</p>';
    tableRank.innerHTML = '';
    return;
  }

  // Hitung per minuman (cents untuk presisi)
  const map = {};
  for (const r of rows) {
    if (!map[r.coffeeName]) map[r.coffeeName] = { cents: 0, count: 0 };
    map[r.coffeeName].cents += Math.round(r.money * 100);
    map[r.coffeeName].count++;
  }
  let entries = Object.entries(map).map(([name, v]) => ({
    name,
    val: metric === 'value' ? v.cents / 100 : v.count,
  }));
  entries.sort((a, b) => b.val - a.val);

  const topN = topNRaw === 'all' ? entries : entries.slice(0, parseInt(topNRaw));

  renderBarOrLineChart(chartRank, {
    labels: topN.map(e => e.name),
    values: topN.map(e => e.val),
    unit: metric === 'value' ? 'satuan moneter' : 'transaksi',
    color: '#3A7A60',
    type: 'bar',
    horizontal: true,
  });

  tableRank.innerHTML = buildSummaryTable(
    ['#', 'Minuman', metricLabel],
    topN.map((e, i) => [i + 1, e.name, metric === 'value' ? formatNum(e.val) : e.val.toLocaleString('id-ID')])
  );
}

/* ============================================================
   GRAFIK AKTIVITAS PER JAM
   ============================================================ */
function renderHour(rows) {
  const metric = metricSelect.value;
  const metricLabel = metric === 'value' ? 'Nilai Penjualan' : 'Jumlah Transaksi';

  if (rows.length === 0) {
    chartHour.innerHTML = '<p class="muted" style="padding:1rem">Tidak ada data.</p>';
    tableHour.innerHTML = '';
    return;
  }

  const hourMap = {};
  for (let h = 0; h < 24; h++) hourMap[h] = { cents: 0, count: 0 };
  for (const r of rows) {
    const h = parseInt(r.time.slice(0, 2), 10);
    if (h >= 0 && h < 24) {
      hourMap[h].cents += Math.round(r.money * 100);
      hourMap[h].count++;
    }
  }

  const labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
  const values = Array.from({ length: 24 }, (_, i) =>
    metric === 'value' ? hourMap[i].cents / 100 : hourMap[i].count
  );

  renderBarOrLineChart(chartHour, {
    labels,
    values,
    unit: metric === 'value' ? 'satuan moneter' : 'transaksi',
    color: '#5A7A6A',
    type: 'bar',
  });

  tableHour.innerHTML = buildSummaryTable(
    ['Jam', metricLabel],
    labels.map((l, i) => [l, metric === 'value' ? formatNum(values[i]) : values[i].toLocaleString('id-ID')])
  );
}

/* ============================================================
   GRAFIK PEMBAYARAN
   ============================================================ */
function renderPayment(rows) {
  const metric = metricSelect.value;
  const metricLabel = metric === 'value' ? 'Nilai Penjualan' : 'Jumlah Transaksi';

  if (rows.length === 0) {
    chartPayment.innerHTML = '<p class="muted" style="padding:1rem">Tidak ada data.</p>';
    tablePayment.innerHTML = '';
    return;
  }

  const map = {};
  for (const r of rows) {
    if (!map[r.cashType]) map[r.cashType] = { cents: 0, count: 0 };
    map[r.cashType].cents += Math.round(r.money * 100);
    map[r.cashType].count++;
  }

  const entries = Object.entries(map).sort((a, b) => {
    const va = metric === 'value' ? a[1].cents : a[1].count;
    const vb = metric === 'value' ? b[1].cents : b[1].count;
    return vb - va;
  });

  renderBarOrLineChart(chartPayment, {
    labels: entries.map(([k]) => toTitleCase(k)),
    values: entries.map(([, v]) => metric === 'value' ? v.cents / 100 : v.count),
    unit: metric === 'value' ? 'satuan moneter' : 'transaksi',
    color: '#285544',
    type: 'bar',
  });

  tablePayment.innerHTML = buildSummaryTable(
    ['Pembayaran', metricLabel],
    entries.map(([k, v]) => [toTitleCase(k), metric === 'value' ? formatNum(v.cents / 100) : v.count.toLocaleString('id-ID')])
  );
}

/* ============================================================
   SVG CHART RENDERER
   ============================================================ */
/**
 * Render bar chart atau line chart menggunakan SVG murni.
 * @param {HTMLElement} container
 * @param {{ labels, values, unit, color, type, horizontal?, partials? }} opts
 */
function renderBarOrLineChart(container, opts) {
  const { labels, values, unit, color, type, horizontal = false, partials = [] } = opts;

  const maxVal = Math.max(...values, 0);
  const n = labels.length;

  if (n === 0) {
    container.innerHTML = '<p class="muted" style="padding:1rem">Tidak ada data untuk ditampilkan.</p>';
    return;
  }

  if (horizontal) {
    renderHorizontalBar(container, labels, values, unit, color, partials);
    return;
  }

  if (type === 'line') {
    renderLineChart(container, labels, values, unit, color, partials);
    return;
  }

  // Vertical bar chart
  const PAD_LEFT  = 70;
  const PAD_RIGHT = 16;
  const PAD_TOP   = 32;  // ruang untuk label nilai di atas bar tertinggi
  const PAD_BOT   = 60;
  const chartW    = Math.max(n * 40 + PAD_LEFT + PAD_RIGHT, 320);
  const chartH    = 260;
  const innerW    = chartW - PAD_LEFT - PAD_RIGHT;
  const innerH    = chartH - PAD_TOP - PAD_BOT;

  const yTicks = niceTicks(0, maxVal, 5);
  const yMax   = yTicks[yTicks.length - 1] || 1;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${chartW}" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" role="img" aria-label="Grafik batang">`;
  svg += `<title>Grafik batang — ${unit}</title>`;

  // Grid & Y axis ticks
  for (const t of yTicks) {
    const y = PAD_TOP + innerH - (t / yMax) * innerH;
    svg += `<line x1="${PAD_LEFT}" y1="${y}" x2="${chartW - PAD_RIGHT}" y2="${y}" stroke="#D9D1C0" stroke-width="1" stroke-dasharray="4,3"/>`;
    svg += `<text x="${PAD_LEFT - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#5E6E62">${formatTickVal(t)}</text>`;
  }

  // Bars
  const barW = Math.max(Math.min(innerW / n - 4, 40), 6);
  const slotW = innerW / n;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    const barH = maxVal === 0 ? 0 : (v / yMax) * innerH;
    const x = PAD_LEFT + slotW * i + slotW / 2 - barW / 2;
    const y = PAD_TOP + innerH - barH;
    const partial = partials[i];
    const fill = partial ? '#8AAA98' : color;

    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${fill}" rx="2"/>`;

    // Nilai di atas bar (hanya jika cukup besar)
    if (barH > 14) {
      svg += `<text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" font-size="9" fill="${color}">${formatTickVal(v)}</text>`;
    }

    // Label X
    const labelX = PAD_LEFT + slotW * i + slotW / 2;
    const labelY = PAD_TOP + innerH + 14;
    svg += rotatedText(labelX, labelY, labels[i] + (partial ? ' ⚑' : ''), 10, '#5E6E62', n > 10 ? -40 : -30);
  }

  // Axes
  svg += `<line x1="${PAD_LEFT}" y1="${PAD_TOP}" x2="${PAD_LEFT}" y2="${PAD_TOP + innerH}" stroke="#24352D" stroke-width="1.5"/>`;
  svg += `<line x1="${PAD_LEFT}" y1="${PAD_TOP + innerH}" x2="${chartW - PAD_RIGHT}" y2="${PAD_TOP + innerH}" stroke="#24352D" stroke-width="1.5"/>`;

  // Unit label Y
  svg += `<text x="11" y="${PAD_TOP + innerH / 2}" text-anchor="middle" font-size="9" fill="#5E6E62" transform="rotate(-90, 11, ${PAD_TOP + innerH / 2})">${unit}</text>`;

  // Legenda parsial
  if (partials.some(Boolean)) {
    svg += `<rect x="${PAD_LEFT}" y="${chartH - 12}" width="10" height="10" fill="#8AAA98" rx="2"/>`;
    svg += `<text x="${PAD_LEFT + 14}" y="${chartH - 3}" font-size="9" fill="#5E6E62">⚑ Periode parsial</text>`;
  }

  svg += '</svg>';
  container.innerHTML = svg;
}

function renderHorizontalBar(container, labels, values, unit, color, partials) {
  const maxVal = Math.max(...values, 0);
  const n = labels.length;

  const ROW_H   = 28;
  const PAD_LEFT  = 150;
  const PAD_RIGHT = 60;
  const PAD_TOP   = 20;
  const PAD_BOT   = 30;
  const chartW    = 460;
  const chartH    = PAD_TOP + n * ROW_H + PAD_BOT;
  const innerW    = chartW - PAD_LEFT - PAD_RIGHT;

  const xTicks = niceTicks(0, maxVal, 5);
  const yMax = xTicks[xTicks.length - 1] || 1;  // tick tertinggi selalu > maxVal

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${chartW} ${chartH}" role="img" aria-label="Grafik batang horizontal">`;
  svg += `<title>Grafik batang horizontal — ${unit}</title>`;

  // X grid ticks
  for (const t of xTicks) {
    const x = PAD_LEFT + (t / yMax) * innerW;
    svg += `<line x1="${x}" y1="${PAD_TOP}" x2="${x}" y2="${PAD_TOP + n * ROW_H}" stroke="#D9D1C0" stroke-width="1" stroke-dasharray="4,3"/>`;
    svg += `<text x="${x}" y="${PAD_TOP + n * ROW_H + 14}" text-anchor="middle" font-size="9" fill="#5E6E62">${formatTickVal(t)}</text>`;
  }

  // Bars & labels
  for (let i = 0; i < n; i++) {
    const v = values[i];
    const barW = maxVal === 0 ? 0 : (v / yMax) * innerW;
    const y = PAD_TOP + i * ROW_H + 4;
    const barH = ROW_H - 8;
    const fill = color;

    // Label kiri
    svg += `<text x="${PAD_LEFT - 6}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="10" fill="#24352D">${escapeHTML(labels[i])}</text>`;

    // Bar
    svg += `<rect x="${PAD_LEFT}" y="${y}" width="${barW}" height="${barH}" fill="${fill}" rx="2"/>`;

    // Nilai kanan
    svg += `<text x="${PAD_LEFT + barW + 4}" y="${y + barH / 2 + 4}" text-anchor="start" font-size="9" fill="#24352D">${formatTickVal(v)}</text>`;
  }

  // Axes
  svg += `<line x1="${PAD_LEFT}" y1="${PAD_TOP}" x2="${PAD_LEFT}" y2="${PAD_TOP + n * ROW_H}" stroke="#24352D" stroke-width="1.5"/>`;
  svg += `<line x1="${PAD_LEFT}" y1="${PAD_TOP + n * ROW_H}" x2="${chartW - PAD_RIGHT}" y2="${PAD_TOP + n * ROW_H}" stroke="#24352D" stroke-width="1.5"/>`;

  svg += `<text x="${PAD_LEFT + innerW / 2}" y="${chartH}" text-anchor="middle" font-size="9" fill="#5E6E62">${unit}</text>`;

  svg += '</svg>';
  container.innerHTML = svg;
}

function renderLineChart(container, labels, values, unit, color, partials) {
  const n = labels.length;
  const maxVal = Math.max(...values, 0);

  const PAD_LEFT  = 70;
  const PAD_RIGHT = 16;
  const PAD_TOP   = 32;  // ruang untuk dot + stroke di atas titik tertinggi
  const PAD_BOT   = 70;
  const chartW    = Math.max(n * 50 + PAD_LEFT + PAD_RIGHT, 400);
  const chartH    = 280;
  const innerW    = chartW - PAD_LEFT - PAD_RIGHT;
  const innerH    = chartH - PAD_TOP - PAD_BOT;

  const yTicks = niceTicks(0, maxVal, 5);
  const yMax   = yTicks[yTicks.length - 1] || 1;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${chartW}" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" role="img" aria-label="Grafik garis tren">`;
  svg += `<title>Grafik tren — ${unit}</title>`;

  // Grid
  for (const t of yTicks) {
    const y = PAD_TOP + innerH - (t / yMax) * innerH;
    svg += `<line x1="${PAD_LEFT}" y1="${y}" x2="${chartW - PAD_RIGHT}" y2="${y}" stroke="#D9D1C0" stroke-width="1" stroke-dasharray="4,3"/>`;
    svg += `<text x="${PAD_LEFT - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#5E6E62">${formatTickVal(t)}</text>`;
  }

  // Line path
  const slotW = innerW / (n - 1 || 1);
  const pts = values.map((v, i) => {
    const x = n === 1 ? PAD_LEFT + innerW / 2 : PAD_LEFT + i * slotW;
    const y = PAD_TOP + innerH - (maxVal === 0 ? 0 : (v / yMax) * innerH);
    return { x, y };
  });

  if (n > 1) {
    const d = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
    svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;

    // Fill area
    const areaD = `M${pts[0].x},${PAD_TOP + innerH} L${pts[0].x},${pts[0].y} ` +
      pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ') +
      ` L${pts[n - 1].x},${PAD_TOP + innerH} Z`;
    svg += `<path d="${areaD}" fill="${color}" fill-opacity="0.08"/>`;
  }

  // Dots + labels X
  for (let i = 0; i < n; i++) {
    const { x, y } = pts[i];
    const partial = partials[i];
    svg += `<circle cx="${x}" cy="${y}" r="4" fill="${partial ? '#8AAA98' : color}" stroke="#fff" stroke-width="1.5"/>`;

    // Rotated x-label
    svg += rotatedText(x, PAD_TOP + innerH + 12, labels[i] + (partial ? ' ⚑' : ''), 9, '#5E6E62', n > 8 ? -45 : -30);
  }

  // Axes
  svg += `<line x1="${PAD_LEFT}" y1="${PAD_TOP}" x2="${PAD_LEFT}" y2="${PAD_TOP + innerH}" stroke="#24352D" stroke-width="1.5"/>`;
  svg += `<line x1="${PAD_LEFT}" y1="${PAD_TOP + innerH}" x2="${chartW - PAD_RIGHT}" y2="${PAD_TOP + innerH}" stroke="#24352D" stroke-width="1.5"/>`;

  // Y unit
  svg += `<text x="11" y="${PAD_TOP + innerH / 2}" text-anchor="middle" font-size="9" fill="#5E6E62" transform="rotate(-90, 11, ${PAD_TOP + innerH / 2})">${unit}</text>`;

  // Legenda parsial
  if (partials.some(Boolean)) {
    svg += `<circle cx="${PAD_LEFT + 6}" cy="${chartH - 8}" r="4" fill="#8AAA98"/>`;
    svg += `<text x="${PAD_LEFT + 14}" y="${chartH - 4}" font-size="9" fill="#5E6E62">⚑ Periode parsial</text>`;
  }

  svg += '</svg>';
  container.innerHTML = svg;
}

/** Rotated text untuk label sumbu X miring */
function rotatedText(x, y, text, fontSize, fill, angle) {
  return `<text x="${x}" y="${y}" text-anchor="end" font-size="${fontSize}" fill="${fill}" transform="rotate(${angle}, ${x}, ${y})">${escapeHTML(text)}</text>`;
}

/** Nilai tick yang rapi (nol ke maks, n langkah).
 *  Tick tertinggi selalu LEBIH BESAR dari maxVal agar elemen tidak menyentuh batas atas. */
function niceTicks(min, max, n) {
  if (max === 0) return [0];
  const raw  = max / n;
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 2.5, 5, 10].find(f => f * mag >= raw) * mag;
  const ticks = [];
  for (let v = 0; v <= max; v += nice) {
    ticks.push(parseFloat(v.toFixed(10)));
  }
  // Jika tick terakhir == max (pas di batas), tambah satu langkah lagi
  // agar selalu ada ruang di atas nilai tertinggi.
  if (ticks[ticks.length - 1] <= max) {
    ticks.push(parseFloat((ticks[ticks.length - 1] + nice).toFixed(10)));
  }
  return ticks;
}

/** Format angka untuk tick label: ribuan singkat */
function formatTickVal(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'jt';
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + 'rb';
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
}

/* ============================================================
   SUMMARY TABLE HELPER
   ============================================================ */
function buildSummaryTable(headers, rows) {
  let html = '<table><thead><tr>' +
    headers.map(h => `<th>${escapeHTML(String(h))}</th>`).join('') +
    '</tr></thead><tbody>';
  for (const row of rows) {
    html += '<tr>' + row.map(c => `<td>${escapeHTML(String(c))}</td>`).join('') + '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

/* ============================================================
   TABEL TRANSAKSI
   ============================================================ */
function renderTable(rows) {
  const total = rows.length;
  const pageSize = state.pageSize;
  const page     = state.page;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage   = Math.min(page, totalPages);
  state.page = safePage;

  tableStatus.textContent = `Menampilkan ${total === 0 ? 0 : (safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, total)} dari ${total.toLocaleString('id-ID')} transaksi.`;

  const slice = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  if (slice.length === 0) {
    txBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1rem;color:#5E6E62">Tidak ada transaksi ditemukan.</td></tr>';
  } else {
    txBody.innerHTML = slice.map(r =>
      `<tr>
        <td>${escapeHTML(r.date)}</td>
        <td>${escapeHTML(r.time)}</td>
        <td>${escapeHTML(r.coffeeName)}</td>
        <td>${escapeHTML(toTitleCase(r.cashType))}</td>
        <td>${formatNum(r.money)}</td>
      </tr>`
    ).join('');
  }

  renderPagination(totalPages, safePage);
}

function renderPagination(total, current) {
  if (total <= 1) { pagination.innerHTML = ''; return; }

  const pages = paginationRange(current, total);
  let html = '';

  html += `<button class="pg-btn" ${current === 1 ? 'disabled' : ''} data-page="${current - 1}" aria-label="Halaman sebelumnya">‹</button>`;
  for (const p of pages) {
    if (p === '…') {
      html += `<span style="padding:0 0.2rem;color:#5E6E62">…</span>`;
    } else {
      html += `<button class="pg-btn ${p === current ? 'active' : ''}" data-page="${p}" aria-label="Halaman ${p}" ${p === current ? 'aria-current="page"' : ''}>${p}</button>`;
    }
  }
  html += `<button class="pg-btn" ${current === total ? 'disabled' : ''} data-page="${current + 1}" aria-label="Halaman berikutnya">›</button>`;
  html += `<span class="pg-info">Hal. ${current} / ${total}</span>`;

  pagination.innerHTML = html;
  pagination.querySelectorAll('.pg-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = parseInt(btn.dataset.page);
      render();
    });
  });
}

function paginationRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '…', total);
  } else if (current >= total - 3) {
    pages.push(1, '…', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '…', current - 1, current, current + 1, '…', total);
  }
  return pages;
}

/* ============================================================
   UTIL
   ============================================================ */
function toTitleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
