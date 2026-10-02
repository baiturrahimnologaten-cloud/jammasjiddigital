/**
 * ==========================================================================
 * ReportPrinter: Monthly Mosque Financial Report Generator & Print Engine
 * Menghasilkan Laporan Keuangan Bulanan Kas Masjid Standar Papan Pengumuman
 * ==========================================================================
 */

class ReportPrinter {
  constructor() {
    this.months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    
    // Default signers storage key
    this.STORAGE_KEY_SIGNERS = "masjid_report_signers";
    
    this.selectedYear = new Date().getFullYear();
    this.selectedMonth = new Date().getMonth() + 1; // 1-12
    this.showSignersDrawer = false;
    
    this.currentData = null;
    this.initialized = false;
  }

  /**
   * Ensure modal HTML exists in DOM, bind events
   */
  init(data) {
    this.currentData = data;
    if (!document.getElementById("report-print-modal")) {
      this.injectModalHtml();
      this.bindEvents();
    }
    this.initialized = true;
  }

  /**
   * Load signers info from local storage or defaults
   */
  getSigners() {
    const raw = localStorage.getItem(this.STORAGE_KEY_SIGNERS);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.warn("Error parsing signers", e);
      }
    }
    
    // Default signers & custom report options
    return {
      takmir: "H. Ahmad Syafi'i, M.Ag.",
      bendahara: "H. Muhammad Ridwan",
      city: "Sleman",
      title: "LAPORAN KEUANGAN & PERTANGGUNGJAWABAN KAS MASJID",
      customNote: "Semoga Allah SWT melimpahkan berkah, pahala berlipat ganda, dan kelapangan rezeki bagi para muhsinin dan jamaah sekalian. Aamiin.",
      showQris: true
    };
  }

  /**
   * Save signers info
   */
  saveSigners(signers) {
    localStorage.setItem(this.STORAGE_KEY_SIGNERS, JSON.stringify(signers));
  }

  /**
   * Open the Print Report Modal
   */
  open(data) {
    this.currentData = data || (window.dataStore ? window.dataStore.getData() : null);
    if (!this.initialized) {
      this.init(this.currentData);
    }
    
    // Choose best initial month: if current month has no transactions, find latest transaction month
    this.detectInitialPeriod();
    
    // Populate dropdowns
    this.populatePeriodSelects();
    
    // Populate custom settings inputs
    const signers = this.getSigners();
    if (document.getElementById("report-input-takmir")) document.getElementById("report-input-takmir").value = signers.takmir || "";
    if (document.getElementById("report-input-bendahara")) document.getElementById("report-input-bendahara").value = signers.bendahara || "";
    if (document.getElementById("report-input-city")) document.getElementById("report-input-city").value = signers.city || "";
    if (document.getElementById("report-input-title")) document.getElementById("report-input-title").value = signers.title || "LAPORAN KEUANGAN & PERTANGGUNGJAWABAN KAS MASJID";
    if (document.getElementById("report-input-note")) document.getElementById("report-input-note").value = signers.customNote || "";
    if (document.getElementById("report-check-qris")) document.getElementById("report-check-qris").checked = signers.showQris !== false;
    
    // Render preview
    this.render();
    
    // Show modal
    const modal = document.getElementById("report-print-modal");
    if (modal) {
      modal.classList.add("show");
      document.body.style.overflow = "hidden";
    }
  }

  /**
   * Close the Print Report Modal
   */
  close() {
    const modal = document.getElementById("report-print-modal");
    if (modal) {
      modal.classList.remove("show");
      document.body.style.overflow = "";
    }
  }

  /**
   * Automatically select latest month with transactions if current month has none
   */
  detectInitialPeriod() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const transactions = this.currentData?.infaqTransactions || [];
    if (transactions.length === 0) {
      this.selectedYear = currentYear;
      this.selectedMonth = currentMonth;
      return;
    }
    
    // Check if transactions exist in current month
    const hasCurrent = transactions.some(tx => {
      const parts = tx.date.split('-');
      return parseInt(parts[0], 10) === currentYear && parseInt(parts[1], 10) === currentMonth;
    });
    
    if (hasCurrent) {
      this.selectedYear = currentYear;
      this.selectedMonth = currentMonth;
    } else {
      // Find latest transaction date
      const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = sorted[0];
      if (latest && latest.date) {
        const parts = latest.date.split('-');
        this.selectedYear = parseInt(parts[0], 10) || currentYear;
        this.selectedMonth = parseInt(parts[1], 10) || currentMonth;
      } else {
        this.selectedYear = currentYear;
        this.selectedMonth = currentMonth;
      }
    }
  }

  /**
   * Populate month & year dropdowns
   */
  populatePeriodSelects() {
    const monthSelect = document.getElementById("report-select-month");
    const yearSelect = document.getElementById("report-select-year");
    
    if (monthSelect) {
      monthSelect.innerHTML = this.months.map((m, idx) => {
        const val = idx + 1;
        return `<option value="${val}" ${val === this.selectedMonth ? 'selected' : ''}>${m}</option>`;
      }).join("");
    }
    
    if (yearSelect) {
      // Gather all years from transactions + current year
      const yearsSet = new Set();
      const currentYear = new Date().getFullYear();
      yearsSet.add(currentYear);
      yearsSet.add(currentYear - 1);
      yearsSet.add(currentYear + 1);
      
      const transactions = this.currentData?.infaqTransactions || [];
      transactions.forEach(tx => {
        if (tx.date) {
          const y = parseInt(tx.date.split('-')[0], 10);
          if (y && !isNaN(y)) yearsSet.add(y);
        }
      });
      
      const years = Array.from(yearsSet).sort((a, b) => b - a);
      yearSelect.innerHTML = years.map(y => {
        return `<option value="${y}" ${y === this.selectedYear ? 'selected' : ''}>${y}</option>`;
      }).join("");
    }
  }

  /**
   * Format Rupiah currency
   */
  formatRupiah(amount) {
    const val = Number(amount) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val).replace("Rp", "Rp ");
  }

  /**
   * Format date into readable Indonesian string
   */
  formatDateIndo(dateStr) {
    if (!dateStr) return "-";
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const year = parts[0];
    const monthName = this.months[monthIdx] || parts[1];
    return `${day < 10 ? '0' + day : day} ${monthName} ${year}`;
  }

  /**
   * Calculate monthly financial breakdown
   */
  calculateReport(year, month) {
    const transactions = this.currentData?.infaqTransactions || [];
    
    let saldoAwal = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    const monthlyTxs = [];
    
    // Sort transactions chronologically ascending
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sorted.forEach(tx => {
      const parts = tx.date.split('-');
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10);
      const amt = Number(tx.amount) || 0;
      
      // Transactions occurring BEFORE the selected month accumulate into saldoAwal
      if (txYear < year || (txYear === year && txMonth < month)) {
        if (tx.type === 'income') {
          saldoAwal += amt;
        } else {
          saldoAwal -= amt;
        }
      } 
      // Transactions occurring IN the selected month
      else if (txYear === year && txMonth === month) {
        monthlyTxs.push({ ...tx, amount: amt });
      }
    });
    
    // Calculate running balance for each monthly transaction
    let running = saldoAwal;
    monthlyTxs.forEach(tx => {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
        running += tx.amount;
      } else {
        totalExpense += tx.amount;
        running -= tx.amount;
      }
      tx.runningBalance = running;
    });
    
    const saldoAkhir = running;
    
    return {
      year,
      month,
      monthName: this.months[month - 1] || `Bulan ${month}`,
      saldoAwal,
      totalIncome,
      totalExpense,
      saldoAkhir,
      transactions: monthlyTxs
    };
  }

  /**
   * Render the printable sheet inside the modal
   */
  render() {
    const container = document.getElementById("printable-report-sheet");
    if (!container) return;
    
    const report = this.calculateReport(this.selectedYear, this.selectedMonth);
    const signers = this.getSigners();
    
    const mosqueName = this.currentData?.mosqueName || "Masjid Baiturrahim Nologaten";
    const mosqueAddress = this.currentData?.mosqueAddress || "Jl. Nologaten, Caturtunggal, Depok, Sleman, D.I. Yogyakarta";
    const logoUrl = this.currentData?.logoUrl || "assets/logo.png";
    const qrisUrl = this.currentData?.qrisUrl || "assets/qris.png";
    
    // Today's formatted print date
    const today = new Date();
    const printDateStr = `${today.getDate()} ${this.months[today.getMonth()]} ${today.getFullYear()}`;
    const printTimeStr = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')} WIB`;
    
    // Build table rows
    let tableRowsHtml = "";
    
    // Initial balance row
    tableRowsHtml += `
      <tr style="background: #f1f5f9; font-weight: 600;">
        <td style="text-align: center; font-weight: 700;">-</td>
        <td style="text-align: center; white-space: nowrap;">01 ${report.monthName} ${report.year}</td>
        <td><strong>Saldo Awal Kas Masjid (Bulan Sebelumnya)</strong></td>
        <td style="text-align: right; color: #64748b;">-</td>
        <td style="text-align: right; color: #64748b;">-</td>
        <td style="text-align: right; font-weight: 800; color: #0f172a;">${this.formatRupiah(report.saldoAwal)}</td>
      </tr>
    `;
    
    if (report.transactions.length === 0) {
      tableRowsHtml += `
        <tr>
          <td colspan="6" class="report-empty-row">
            Tidak ada mutasi pemasukan atau pengeluaran kas pada bulan ${report.monthName} ${report.year}.<br>
            Saldo kas tetap tersimpan sebesar <strong>${this.formatRupiah(report.saldoAwal)}</strong>.
          </td>
        </tr>
      `;
    } else {
      report.transactions.forEach((tx, idx) => {
        const isIncome = tx.type === 'income';
        tableRowsHtml += `
          <tr>
            <td style="text-align: center; color: #64748b; font-weight: 600;">${idx + 1}</td>
            <td style="text-align: center; white-space: nowrap; color: #334155;">${this.formatDateIndo(tx.date)}</td>
            <td style="font-weight: 500; color: #0f172a;">${tx.description || '-'}</td>
            <td style="text-align: right; font-weight: 700; color: #059669; white-space: nowrap;">
              ${isIncome ? '+ ' + this.formatRupiah(tx.amount) : '-'}
            </td>
            <td style="text-align: right; font-weight: 700; color: #dc2626; white-space: nowrap;">
              ${!isIncome ? '- ' + this.formatRupiah(tx.amount) : '-'}
            </td>
            <td style="text-align: right; font-weight: 800; color: #0f172a; white-space: nowrap;">
              ${this.formatRupiah(tx.runningBalance)}
            </td>
          </tr>
        `;
      });
    }

    container.innerHTML = `
      <!-- KOP SURAT RESMI -->
      <div class="report-kop-surat">
        <img src="${logoUrl}" alt="Logo Masjid" class="report-kop-logo" onerror="this.src='assets/logo.png'">
        <div class="report-kop-text">
          <div class="report-kop-sub">DEWAN KEMAKMURAN MASJID (DKM) / TAKMIR</div>
          <div class="report-kop-name">${mosqueName}</div>
          <div class="report-kop-address">${mosqueAddress}</div>
        </div>
      </div>
      <div class="report-kop-divider"></div>

      <!-- JUDUL LAPORAN -->
      <div class="report-title-section">
        <div class="report-main-title">${signers.title || 'LAPORAN KEUANGAN & PERTANGGUNGJAWABAN KAS MASJID'}</div>
        <div class="report-period-badge">PERIODE BULAN: ${report.monthName.toUpperCase()} ${report.year}</div>
        <div class="report-print-timestamp">Dipublikasikan untuk Papan Pengumuman • Dicetak pada: ${printDateStr}, pukul ${printTimeStr}</div>
      </div>

      <!-- 4 RINGKASAN KEUANGAN KOTAK -->
      <div class="report-summary-boxes">
        <div class="report-summary-box box-initial">
          <span class="box-lbl">Saldo Kas Awal</span>
          <span class="box-val">${this.formatRupiah(report.saldoAwal)}</span>
        </div>
        <div class="report-summary-box box-income">
          <span class="box-lbl">Total Pemasukan</span>
          <span class="box-val">+ ${this.formatRupiah(report.totalIncome)}</span>
        </div>
        <div class="report-summary-box box-expense">
          <span class="box-lbl">Total Pengeluaran</span>
          <span class="box-val">- ${this.formatRupiah(report.totalExpense)}</span>
        </div>
        <div class="report-summary-box box-final">
          <span class="box-lbl">Saldo Kas Akhir</span>
          <span class="box-val">${this.formatRupiah(report.saldoAkhir)}</span>
        </div>
      </div>

      <!-- TABEL RINCIAN TRANSAKSI -->
      <div class="report-table-wrapper">
        <table class="report-ledger-table">
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">No</th>
              <th style="width: 105px; text-align: center;">Tanggal</th>
              <th style="text-align: left;">Keterangan / Uraian Transaksi</th>
              <th style="width: 125px; text-align: right;">Pemasukan (Rp)</th>
              <th style="width: 125px; text-align: right;">Pengeluaran (Rp)</th>
              <th style="width: 130px; text-align: right;">Saldo Kas (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: right; font-weight: 800;">TOTAL MUTASI BULAN ${report.monthName.toUpperCase()} ${report.year}:</td>
              <td style="text-align: right; color: #047857; font-weight: 800;">+ ${this.formatRupiah(report.totalIncome)}</td>
              <td style="text-align: right; color: #b91c1c; font-weight: 800;">- ${this.formatRupiah(report.totalExpense)}</td>
              <td style="text-align: right; color: #0369a1; font-weight: 800;">${this.formatRupiah(report.saldoAkhir)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- BAGIAN BAWAH: QRIS DONASI & PENGESAHAN TANDA TANGAN -->
      <div class="report-footer-section">
        <div class="report-footer-grid">
          ${signers.showQris !== false ? `
          <!-- Kotak QRIS Jamaah -->
          <div class="report-qris-box">
            <img src="${qrisUrl}" alt="QRIS Infaq" class="report-qris-thumb" onerror="this.src='assets/qris.png'">
            <div class="report-qris-info">
              <strong>INFAQ & SEDEKAH NON-TUNAI</strong>
              Pindai barcode QRIS resmi ${mosqueName} ini menggunakan Mobile Banking atau Dompet Digital Anda untuk berinfaq.
            </div>
          </div>
          ` : '<div></div>'}

          <!-- Tanda Tangan DKM -->
          <div class="report-signature-block">
            <div class="report-signature-date">${signers.city || 'Sleman'}, ${printDateStr}</div>
            <div class="report-signers-flex">
              <div class="report-signer">
                <div class="signer-role">Mengetahui,</div>
                <div class="signer-title">Ketua Takmir / DKM</div>
                <div class="signer-space"></div>
                <div class="signer-name">${signers.takmir || 'Ketua Takmir'}</div>
              </div>
              <div class="report-signer">
                <div class="signer-role">Dibuat oleh,</div>
                <div class="signer-title">Bendahara Kas</div>
                <div class="signer-space"></div>
                <div class="signer-name">${signers.bendahara || 'Bendahara'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- DOA & WATERMARK RESMI -->
        <div class="report-bottom-note">
          <div class="report-doa">
            "${signers.customNote || 'Semoga Allah SWT melimpahkan berkah, pahala berlipat ganda, dan kelapangan rezeki bagi para muhsinin dan jamaah sekalian. Aamiin.'}"
          </div>
          <div>Dokumen Resmi Papan Pengumuman • Sistem Digital Masjid</div>
        </div>
      </div>
    `;
  }

  /**
   * Print Action Handler - Uses isolated iframe for 100% reliable print preview
   */
  print() {
    const sheetEl = document.getElementById("printable-report-sheet");
    if (!sheetEl) {
      window.print();
      return;
    }
    
    const reportHtml = sheetEl.innerHTML;
    
    // Remove existing print iframe if any
    const existingIframe = document.getElementById("report-print-iframe");
    if (existingIframe) {
      existingIframe.remove();
    }
    
    const iframe = document.createElement("iframe");
    iframe.id = "report-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    
    try {
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <base href="${window.location.href}">
          <meta charset="UTF-8">
          <title>Laporan Keuangan Kas Masjid - ${this.months[this.selectedMonth - 1]} ${this.selectedYear}</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap">
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 14mm 10mm 14mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Outfit', 'Segoe UI', Arial, sans-serif;
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0;
              padding: 0;
              width: 100%;
            }
            .printable-report-sheet {
              display: flex;
              flex-direction: column;
              width: 100%;
              background: #ffffff !important;
              color: #0f172a !important;
              padding: 0;
              font-family: 'Outfit', 'Segoe UI', Arial, sans-serif;
            }
            .report-kop-surat {
              display: flex;
              align-items: center;
              gap: 20px;
              padding-bottom: 8px;
            }
            .report-kop-logo {
              width: 75px;
              height: 75px;
              object-fit: contain;
              flex-shrink: 0;
            }
            .report-kop-text {
              flex-grow: 1;
              text-align: center;
            }
            .report-kop-sub {
              font-size: 0.8rem;
              font-weight: 700;
              letter-spacing: 1.5px;
              color: #334155;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .report-kop-name {
              font-size: 1.4rem;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              line-height: 1.2;
            }
            .report-kop-address {
              font-size: 0.8rem;
              color: #475569;
              margin-top: 4px;
              line-height: 1.35;
            }
            .report-kop-divider {
              width: 100%;
              border-top: 3px solid #0f172a;
              border-bottom: 1px solid #0f172a;
              height: 3px;
              margin-top: 10px;
              margin-bottom: 16px;
            }
            .report-title-section {
              text-align: center;
              margin-bottom: 16px;
            }
            .report-main-title {
              font-size: 1.15rem;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .report-period-badge {
              font-size: 0.92rem;
              font-weight: 700;
              color: #0369a1;
              margin-bottom: 4px;
            }
            .report-print-timestamp {
              font-size: 0.72rem;
              color: #64748b;
              font-style: italic;
            }
            .report-summary-boxes {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 18px;
              page-break-inside: avoid;
            }
            .report-summary-box {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 10px 12px;
              background: #f8fafc !important;
              display: flex;
              flex-direction: column;
            }
            .report-summary-box.box-initial { border-left: 4px solid #64748b; }
            .report-summary-box.box-income { border-left: 4px solid #10b981; }
            .report-summary-box.box-expense { border-left: 4px solid #ef4444; }
            .report-summary-box.box-final { border-left: 4px solid #0284c7; background: #f0f9ff !important; }
            .report-summary-box .box-lbl {
              font-size: 0.68rem;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .report-summary-box .box-val {
              font-size: 1.05rem;
              font-weight: 800;
              margin-top: 5px;
              color: #0f172a;
            }
            .report-summary-box.box-income .box-val { color: #047857; }
            .report-summary-box.box-expense .box-val { color: #b91c1c; }
            .report-summary-box.box-final .box-val { color: #0369a1; }
            .report-table-wrapper {
              margin-bottom: 18px;
            }
            .report-ledger-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.8rem;
              border: 1px solid #94a3b8;
            }
            .report-ledger-table th {
              background: #f1f5f9 !important;
              border: 1px solid #94a3b8;
              padding: 8px 10px;
              font-weight: 700;
              color: #1e293b;
              text-transform: uppercase;
              font-size: 0.73rem;
              letter-spacing: 0.3px;
            }
            .report-ledger-table td {
              border: 1px solid #cbd5e1;
              padding: 7px 10px;
              color: #1e293b;
            }
            .report-ledger-table tbody tr:nth-child(even) { background: #f8fafc !important; }
            .report-ledger-table tfoot td {
              background: #f1f5f9 !important;
              border: 1px solid #94a3b8;
              padding: 8px 10px;
              font-weight: 800;
              color: #0f172a;
            }
            .report-empty-row {
              text-align: center;
              padding: 30px !important;
              color: #64748b;
              font-style: italic;
            }
            .report-footer-section {
              margin-top: 14px;
              border-top: 1px dashed #cbd5e1;
              padding-top: 14px;
              page-break-inside: avoid;
            }
            .report-footer-grid {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 20px;
            }
            .report-qris-box {
              display: flex;
              align-items: center;
              gap: 12px;
              border: 1px solid #e2e8f0;
              background: #f8fafc !important;
              padding: 8px 12px;
              border-radius: 8px;
              max-width: 320px;
            }
            .report-qris-thumb {
              width: 60px;
              height: 60px;
              object-fit: contain;
              border-radius: 4px;
              background: #ffffff !important;
              padding: 2px;
              border: 1px solid #cbd5e1;
              flex-shrink: 0;
            }
            .report-qris-info {
              font-size: 0.7rem;
              color: #475569;
              line-height: 1.35;
            }
            .report-qris-info strong {
              color: #0f172a;
              display: block;
              font-size: 0.74rem;
              margin-bottom: 2px;
            }
            .report-signature-block {
              text-align: right;
              flex-grow: 1;
              page-break-inside: avoid;
            }
            .report-signature-date {
              font-size: 0.8rem;
              color: #334155;
              margin-bottom: 8px;
            }
            .report-signers-flex {
              display: flex;
              justify-content: flex-end;
              gap: 40px;
              text-align: center;
            }
            .report-signer {
              min-width: 140px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .report-signer .signer-role {
              font-size: 0.75rem;
              color: #475569;
            }
            .report-signer .signer-title {
              font-size: 0.78rem;
              font-weight: 700;
              color: #0f172a;
              margin-top: 2px;
            }
            .report-signer .signer-space {
              height: 48px;
              width: 100%;
            }
            .report-signer .signer-name {
              font-size: 0.82rem;
              font-weight: 700;
              color: #0f172a;
              border-top: 1px solid #0f172a;
              padding-top: 3px;
              min-width: 130px;
            }
            .report-bottom-note {
              margin-top: 14px;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 0.68rem;
              color: #64748b;
              line-height: 1.4;
            }
            .report-doa {
              font-style: italic;
              font-weight: 500;
              color: #334155;
            }
          </style>
        </head>
        <body>
          <div class="printable-report-sheet">
            ${reportHtml}
          </div>
        </body>
        </html>
      `);
      doc.close();
      
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 300);
    } catch (e) {
      console.warn("Iframe print blocked, falling back to window.print()", e);
      window.print();
    }
  }

  /**
   * Inject Modal HTML into DOM if not present
   */
  injectModalHtml() {
    const existing = document.getElementById("report-print-modal");
    if (existing) return;

    const modalDiv = document.createElement("div");
    modalDiv.id = "report-print-modal";
    modalDiv.className = "report-modal-overlay";
    modalDiv.innerHTML = `
      <div class="report-modal-dialog">
        <!-- Header -->
        <div class="report-modal-header">
          <h3>
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
            </svg>
            Cetak Laporan Keuangan Bulanan (Papan Pengumuman)
          </h3>
          <button type="button" class="report-modal-close-btn" id="btn-close-report-modal" title="Tutup Modal">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Controls Toolbar -->
        <div class="report-controls-panel">
          <div class="report-control-group">
            <div class="report-control-item">
              <label for="report-select-month">Bulan:</label>
              <select id="report-select-month" class="report-select"></select>
            </div>
            <div class="report-control-item">
              <label for="report-select-year">Tahun:</label>
              <select id="report-select-year" class="report-select"></select>
            </div>
            <button type="button" class="btn-toggle-sign-settings" id="btn-toggle-signers" title="Kustomisasi Dokumen Cetak">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Kustomisasi Dokumen Cetak
            </button>
          </div>

          <div class="report-actions">
            <button type="button" class="btn-print-action" id="btn-execute-print">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
              </svg>
              Cetak Sekarang / Simpan PDF
            </button>
          </div>
        </div>

        <!-- Optional Drawer for Signers & Customization -->
        <div class="report-signers-panel" id="report-signers-drawer" style="display: none;">
          <div class="report-control-item" style="flex: 2; min-width: 250px;">
            <label for="report-input-title">Judul Laporan:</label>
            <input type="text" id="report-input-title" class="report-input" placeholder="LAPORAN KEUANGAN & PERTANGGUNGJAWABAN KAS MASJID">
          </div>
          <div class="report-control-item">
            <label for="report-input-takmir">Ketua Takmir / DKM:</label>
            <input type="text" id="report-input-takmir" class="report-input" placeholder="H. Ahmad Syafi'i, M.Ag.">
          </div>
          <div class="report-control-item">
            <label for="report-input-bendahara">Bendahara Kas:</label>
            <input type="text" id="report-input-bendahara" class="report-input" placeholder="H. Muhammad Ridwan">
          </div>
          <div class="report-control-item">
            <label for="report-input-city">Kota Domisili:</label>
            <input type="text" id="report-input-city" class="report-input" placeholder="Sleman">
          </div>
          <div class="report-control-item" style="flex: 2; min-width: 250px;">
            <label for="report-input-note">Catatan / Doa Penutup:</label>
            <input type="text" id="report-input-note" class="report-input" placeholder="Teks doa atau catatan rekening infaq transfer...">
          </div>
          <div class="report-control-item" style="align-items: center; justify-content: flex-start; min-width: 180px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 18px;">
              <input type="checkbox" id="report-check-qris" checked style="width: 16px; height: 16px; cursor: pointer;">
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-main);">Tampilkan Barcode QRIS</span>
            </label>
          </div>
        </div>

        <!-- Paper Preview Viewport -->
        <div class="report-preview-viewport">
          <div id="printable-report-sheet" class="printable-report-sheet">
            <!-- Dynamically populated report content -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalDiv);
  }

  /**
   * Bind event listeners for modal controls
   */
  bindEvents() {
    const modal = document.getElementById("report-print-modal");
    const closeBtn = document.getElementById("btn-close-report-modal");
    const monthSelect = document.getElementById("report-select-month");
    const yearSelect = document.getElementById("report-select-year");
    const toggleSignersBtn = document.getElementById("btn-toggle-signers");
    const signersDrawer = document.getElementById("report-signers-drawer");
    const inputTakmir = document.getElementById("report-input-takmir");
    const inputBendahara = document.getElementById("report-input-bendahara");
    const inputCity = document.getElementById("report-input-city");
    const inputTitle = document.getElementById("report-input-title");
    const inputNote = document.getElementById("report-input-note");
    const checkQris = document.getElementById("report-check-qris");
    const printBtn = document.getElementById("btn-execute-print");

    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.close();
      });
    }

    if (monthSelect) {
      monthSelect.addEventListener("change", (e) => {
        this.selectedMonth = parseInt(e.target.value, 10);
        this.render();
      });
    }

    if (yearSelect) {
      yearSelect.addEventListener("change", (e) => {
        this.selectedYear = parseInt(e.target.value, 10);
        this.render();
      });
    }

    if (toggleSignersBtn && signersDrawer) {
      toggleSignersBtn.addEventListener("click", () => {
        this.showSignersDrawer = !this.showSignersDrawer;
        signersDrawer.style.display = this.showSignersDrawer ? "flex" : "none";
      });
    }

    const updateCustomSettings = () => {
      const settings = {
        takmir: inputTakmir ? inputTakmir.value.trim() : "Ketua Takmir",
        bendahara: inputBendahara ? inputBendahara.value.trim() : "Bendahara",
        city: inputCity ? inputCity.value.trim() : "Sleman",
        title: inputTitle && inputTitle.value.trim() ? inputTitle.value.trim() : "LAPORAN KEUANGAN & PERTANGGUNGJAWABAN KAS MASJID",
        customNote: inputNote ? inputNote.value.trim() : "",
        showQris: checkQris ? checkQris.checked : true
      };
      this.saveSigners(settings);
      this.render();
    };

    if (inputTakmir) inputTakmir.addEventListener("input", updateCustomSettings);
    if (inputBendahara) inputBendahara.addEventListener("input", updateCustomSettings);
    if (inputCity) inputCity.addEventListener("input", updateCustomSettings);
    if (inputTitle) inputTitle.addEventListener("input", updateCustomSettings);
    if (inputNote) inputNote.addEventListener("input", updateCustomSettings);
    if (checkQris) checkQris.addEventListener("change", updateCustomSettings);

    if (printBtn) {
      printBtn.addEventListener("click", () => this.print());
    }

    // Keyboard ESC shortcut to close
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.classList.contains("show")) {
        this.close();
      }
    });
  }
}

// Global instance
window.reportPrinter = new ReportPrinter();
