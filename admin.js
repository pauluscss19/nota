document.addEventListener('DOMContentLoaded', () => {
    // ================= DATA LAYER =================
    const STORAGE_KEY = 'jokikilat_transactions';

    function getTransactions() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    }

    function saveTransactions(transactions) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }

    // ================= DOM REFERENCES =================
    const totalRevenueEl = document.getElementById('totalRevenue');
    const monthRevenueEl = document.getElementById('monthRevenue');
    const totalTransactionsEl = document.getElementById('totalTransactions');
    const monthTransactionsEl = document.getElementById('monthTransactions');
    const tableBody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const filterMonth = document.getElementById('filterMonth');
    const exportBtn = document.getElementById('exportBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const summaryBody = document.getElementById('summaryBody');
    const revenueCanvas = document.getElementById('revenueChart');

    // ================= HELPERS =================
    const MONTH_NAMES = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    function formatK(val) {
        if (val >= 1000) return (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + 'JT';
        if (val === 0) return '0K';
        return val + 'K';
    }

    function formatDate(isoStr) {
        const d = new Date(isoStr);
        const day = String(d.getDate()).padStart(2, '0');
        const mon = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hour = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${mon}/${year} ${hour}:${min}`;
    }

    function getMonthKey(isoStr) {
        const d = new Date(isoStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function getMonthLabel(monthKey) {
        const [year, month] = monthKey.split('-');
        return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
    }

    function isCurrentMonth(isoStr) {
        const d = new Date(isoStr);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }

    // ================= DASHBOARD STATS =================
    function updateDashboard() {
        const transactions = getTransactions();
        let totalRev = 0;
        let monthRev = 0;
        let monthCount = 0;

        transactions.forEach(t => {
            totalRev += t.total;
            if (isCurrentMonth(t.date)) {
                monthRev += t.total;
                monthCount++;
            }
        });

        totalRevenueEl.textContent = formatK(totalRev);
        monthRevenueEl.textContent = formatK(monthRev);
        totalTransactionsEl.textContent = transactions.length;
        monthTransactionsEl.textContent = monthCount;
    }

    // ================= FILTER MONTH DROPDOWN =================
    function populateMonthFilter() {
        const transactions = getTransactions();
        const months = new Set();
        transactions.forEach(t => months.add(getMonthKey(t.date)));

        const sortedMonths = Array.from(months).sort().reverse();

        // Keep current selection
        const currentVal = filterMonth.value;
        filterMonth.innerHTML = '<option value="all">Semua Bulan</option>';
        sortedMonths.forEach(mk => {
            const opt = document.createElement('option');
            opt.value = mk;
            opt.textContent = getMonthLabel(mk);
            filterMonth.appendChild(opt);
        });

        // Restore selection if still valid
        if (currentVal && filterMonth.querySelector(`option[value="${currentVal}"]`)) {
            filterMonth.value = currentVal;
        }
    }

    // ================= TRANSACTION TABLE =================
    function renderTable() {
        const transactions = getTransactions();
        const searchTerm = searchInput.value.trim().toLowerCase();
        const monthFilter = filterMonth.value;

        // Filter
        let filtered = transactions.filter(t => {
            const matchSearch = !searchTerm || t.customerCode.toLowerCase().includes(searchTerm);
            const matchMonth = monthFilter === 'all' || getMonthKey(t.date) === monthFilter;
            return matchSearch && matchMonth;
        });

        // Sort newest first
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        tableBody.innerHTML = '';

        if (filtered.length === 0) {
            document.getElementById('transactionTable').style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        document.getElementById('transactionTable').style.display = '';
        emptyState.style.display = 'none';

        filtered.forEach((t, i) => {
            const tr = document.createElement('tr');

            // Items display
            const itemsHtml = t.items.map(it => `<span>${it.name} ${it.price}K</span>`).join(' ');

            // Status button
            const isLunas = t.status === 'lunas';
            const statusClass = isLunas ? 'btn-status-lunas' : 'btn-status-belum';
            const statusText = isLunas ? '✅ Lunas' : '⏳ Belum Bayar';

            tr.innerHTML = `
                <td>${i + 1}</td>
                <td style="white-space:nowrap">${formatDate(t.date)}</td>
                <td><strong>${t.customerCode}</strong></td>
                <td><div class="order-items">${itemsHtml}</div></td>
                <td><strong>${t.total}K</strong></td>
                <td>
                    <button class="btn btn-sm ${statusClass}" data-action="toggle-status" data-id="${t.id}">
                        ${statusText}
                    </button>
                </td>
                <td>
                    <div class="td-actions">
                        <button class="btn btn-sm btn-delete" data-action="delete" data-id="${t.id}">🗑️</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ================= TABLE ACTIONS (Event Delegation) =================
    tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;
        let transactions = getTransactions();

        if (action === 'toggle-status') {
            transactions = transactions.map(t => {
                if (t.id === id) {
                    t.status = t.status === 'lunas' ? 'belum_bayar' : 'lunas';
                }
                return t;
            });
            saveTransactions(transactions);
            refreshAll();
        }

        if (action === 'delete') {
            if (confirm('Hapus transaksi ini?')) {
                transactions = transactions.filter(t => t.id !== id);
                saveTransactions(transactions);
                refreshAll();
            }
        }
    });

    // ================= SEARCH & FILTER =================
    searchInput.addEventListener('input', renderTable);
    filterMonth.addEventListener('change', renderTable);

    // ================= CLEAR ALL =================
    clearAllBtn.addEventListener('click', () => {
        const transactions = getTransactions();
        if (transactions.length === 0) {
            alert('Tidak ada data untuk dihapus.');
            return;
        }
        if (confirm(`Yakin ingin menghapus semua ${transactions.length} transaksi? Data tidak bisa dikembalikan.`)) {
            localStorage.removeItem(STORAGE_KEY);
            refreshAll();
        }
    });

    // ================= EXPORT CSV =================
    exportBtn.addEventListener('click', () => {
        const transactions = getTransactions();
        if (transactions.length === 0) {
            alert('Tidak ada data untuk diexport.');
            return;
        }

        // Build CSV
        const headers = ['No', 'Tanggal', 'Kode Customer', 'Pesanan', 'Total (K)', 'Status'];
        const rows = transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((t, i) => {
                const items = t.items.map(it => `${it.name} ${it.price}K`).join('; ');
                const status = t.status === 'lunas' ? 'Lunas' : 'Belum Bayar';
                return [i + 1, formatDate(t.date), t.customerCode, `"${items}"`, t.total, status];
            });

        let csv = '\uFEFF'; // BOM for Excel UTF-8
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.join(',') + '\n';
        });

        // Calculate totals
        const totalAll = transactions.reduce((sum, t) => sum + t.total, 0);
        const totalLunas = transactions.filter(t => t.status === 'lunas').reduce((sum, t) => sum + t.total, 0);
        csv += '\n';
        csv += `,,,,Total Keseluruhan,${totalAll}K\n`;
        csv += `,,,,Total Lunas,${totalLunas}K\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        link.download = `Laporan_JokiKilat_${dateStr}.csv`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    });

    // ================= MONTHLY SUMMARY =================
    function renderSummary() {
        const transactions = getTransactions();
        const monthMap = {};

        transactions.forEach(t => {
            const mk = getMonthKey(t.date);
            if (!monthMap[mk]) {
                monthMap[mk] = { count: 0, lunas: 0, belum: 0, total: 0 };
            }
            monthMap[mk].count++;
            monthMap[mk].total += t.total;
            if (t.status === 'lunas') {
                monthMap[mk].lunas++;
            } else {
                monthMap[mk].belum++;
            }
        });

        const sortedMonths = Object.keys(monthMap).sort().reverse();
        summaryBody.innerHTML = '';

        if (sortedMonths.length === 0) {
            summaryBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:1.5rem;">Belum ada data</td></tr>';
            return;
        }

        sortedMonths.forEach(mk => {
            const data = monthMap[mk];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${getMonthLabel(mk)}</td>
                <td>${data.count}</td>
                <td style="color:#059669;font-weight:600">${data.lunas}</td>
                <td style="color:#d97706;font-weight:600">${data.belum}</td>
                <td><strong>${formatK(data.total)}</strong></td>
            `;
            summaryBody.appendChild(tr);
        });
    }

    // ================= CHART (Pure Canvas) =================
    function renderChart() {
        const ctx = revenueCanvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = revenueCanvas.parentElement.getBoundingClientRect();

        revenueCanvas.width = rect.width * dpr;
        revenueCanvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const W = rect.width;
        const H = rect.height;

        // Clear
        ctx.clearRect(0, 0, W, H);

        // Get last 6 months data
        const transactions = getTransactions();
        const now = new Date();
        const months = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = MONTH_NAMES[d.getMonth()].substring(0, 3);
            months.push({ key: mk, label: label, total: 0 });
        }

        transactions.forEach(t => {
            const mk = getMonthKey(t.date);
            const found = months.find(m => m.key === mk);
            if (found) found.total += t.total;
        });

        const maxVal = Math.max(...months.map(m => m.total), 1);

        // Chart dimensions
        const padding = { top: 30, right: 20, bottom: 40, left: 55 };
        const chartW = W - padding.left - padding.right;
        const chartH = H - padding.top - padding.bottom;
        const barWidth = Math.min(chartW / months.length * 0.5, 60);
        const gap = chartW / months.length;

        // Draw grid lines
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        const gridLines = 4;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(W - padding.right, y);
            ctx.stroke();

            // Y-axis labels
            const val = maxVal - (maxVal / gridLines) * i;
            ctx.fillStyle = '#6b7280';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(formatK(Math.round(val)), padding.left - 8, y + 4);
        }

        // Draw bars
        months.forEach((m, i) => {
            const x = padding.left + gap * i + (gap - barWidth) / 2;
            const barH = maxVal > 0 ? (m.total / maxVal) * chartH : 0;
            const y = padding.top + chartH - barH;

            // Bar gradient
            const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(1, '#1d4ed8');

            // Rounded top bar
            const radius = Math.min(barWidth / 4, 6);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + barWidth - radius, y);
            ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
            ctx.lineTo(x + barWidth, padding.top + chartH);
            ctx.lineTo(x, padding.top + chartH);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Value on top of bar
            if (m.total > 0) {
                ctx.fillStyle = '#111827';
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(formatK(m.total), x + barWidth / 2, y - 8);
            }

            // X-axis label
            ctx.fillStyle = '#6b7280';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.label, x + barWidth / 2, padding.top + chartH + 22);
        });

        // If all zeros, show message
        if (months.every(m => m.total === 0)) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Belum ada data pendapatan', W / 2, H / 2);
        }
    }

    // ================= REFRESH ALL =================
    function refreshAll() {
        updateDashboard();
        populateMonthFilter();
        renderTable();
        renderSummary();
        renderChart();
    }

    // ================= INIT =================
    refreshAll();

    // Redraw chart on resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(renderChart, 150);
    });
});
