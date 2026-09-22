document.addEventListener('DOMContentLoaded', () => {
    // Referensi elemen input
    const customerCodeInput = document.getElementById('customerCode');
    const itemNameInput = document.getElementById('itemName');
    const itemPriceInput = document.getElementById('itemPrice');
    const addBtn = document.getElementById('addBtn');
    
    // Referensi elemen tampilan (preview) & list
    const controlList = document.getElementById('controlList');
    const displayCustomerCode = document.getElementById('displayCustomerCode');
    const displayJokiList = document.getElementById('displayJokiList');
    const displayTotal = document.getElementById('displayTotal');
    
    // Referensi tombol dan container struk
    const downloadBtn = document.getElementById('downloadBtn');
    const receiptCard = document.getElementById('receiptCard');

    // Array penyimpan daftar pesanan
    let items = [];

    // Fungsi untuk memformat harga ke format K
    // Jika user menginput 100 -> 100K
    // Jika user menginput 100000 -> 100K
    function formatPriceToK(price) {
        let val = parseFloat(price);
        if (isNaN(val)) return 0;
        
        if (val >= 1000) {
            val = val / 1000;
        }
        return val;
    }

    // Fungsi untuk merender daftar di form kontrol dan di nota
    function renderList() {
        controlList.innerHTML = '';
        displayJokiList.innerHTML = '';
        let total = 0;

        items.forEach((item, index) => {
            // Render di panel kontrol (agar bisa dihapus)
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.name} - ${item.price}K</span>
                <button class="remove-btn" onclick="removeItem(${index})" title="Hapus">X</button>
            `;
            controlList.appendChild(li);

            // Render di nota
            const receiptItem = document.createElement('div');
            receiptItem.className = 'joki-item';
            receiptItem.style.display = 'flex';
            receiptItem.style.justifyContent = 'space-between';
            receiptItem.innerHTML = `
                <span>${index + 1}. ${item.name}</span>
                <strong>${item.price}K</strong>
            `;
            displayJokiList.appendChild(receiptItem);

            // Hitung total
            total += item.price;
        });

        // Update tampilan total di nota
        displayTotal.textContent = `${total}K`;
    }

    // Menjadikan fungsi removeItem global agar bisa dipanggil oleh tombol Hapus (onclick)
    window.removeItem = function(index) {
        items.splice(index, 1);
        renderList();
    };

    // Event Listener untuk tambah pesanan
    addBtn.addEventListener('click', () => {
        const name = itemNameInput.value.trim();
        const priceRaw = itemPriceInput.value.trim();

        if (name !== '' && priceRaw !== '') {
            const price = formatPriceToK(priceRaw);
            items.push({ name, price });
            
            // Bersihkan input dan render ulang
            itemNameInput.value = '';
            itemPriceInput.value = '';
            renderList();
            
            // Kembalikan fokus ke input nama joki
            itemNameInput.focus();
        } else {
            alert('Silakan masukkan nama joki dan harganya!');
        }
    });

    // Event Listener jika menekan tombol Enter pada input harga
    itemPriceInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addBtn.click();
        }
    });

    // 1. Event Listener untuk Kode Customer
    customerCodeInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        displayCustomerCode.textContent = value || '-';
    });

    // Fungsi untuk menyimpan transaksi ke localStorage (otomatis saat download nota)
    function saveTransaction() {
        const transactions = JSON.parse(localStorage.getItem('jokikilat_transactions') || '[]');
        const custCode = customerCodeInput.value.trim() || 'Baru';
        let total = 0;
        items.forEach(item => { total += item.price; });

        const transaction = {
            id: 'TXN-' + Date.now(),
            customerCode: custCode,
            items: items.map(item => ({ name: item.name, price: item.price })),
            total: total,
            date: new Date().toISOString(),
            status: 'belum_bayar'
        };

        transactions.push(transaction);
        localStorage.setItem('jokikilat_transactions', JSON.stringify(transactions));
    }

    // 4. Proses Download Nota menjadi Gambar (JPG) menggunakan html2canvas
    downloadBtn.addEventListener('click', async () => {
        // Cek jika list kosong
        if (items.length === 0) {
            const confirmEmpty = confirm('Daftar pesanan masih kosong. Yakin ingin mengunduh nota?');
            if (!confirmEmpty) return;
        }

        // Ubah state tombol agar tidak diklik berkali-kali
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = 'Memproses...';
        downloadBtn.disabled = true;

        try {
            // Swap gambar ke base64 agar tidak kena CORS (baik di file:// maupun https://)
            const images = receiptCard.querySelectorAll('img');
            const originalSrcs = [];
            images.forEach(img => {
                originalSrcs.push(img.src);
                if (typeof IMAGES_BASE64 !== 'undefined') {
                    if (img.src.includes('logo')) {
                        img.src = IMAGES_BASE64.logo;
                    } else if (img.src.includes('qris')) {
                        img.src = IMAGES_BASE64.qris;
                    }
                }
            });

            // Tunggu sebentar agar gambar base64 ter-render
            await new Promise(r => setTimeout(r, 100));

            // html2canvas config
            const canvas = await html2canvas(receiptCard, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });

            // Restore gambar asli
            images.forEach((img, i) => { img.src = originalSrcs[i]; });

            // Konversi canvas ke image URL
            const imageUrl = canvas.toDataURL('image/jpeg', 0.95);

            // Buat elemen anchor sementara untuk trigger download
            const link = document.createElement('a');
            const custCode = customerCodeInput.value.trim() || 'Baru';
            link.download = `Nota_JokiKilat_${custCode}.jpg`;
            link.href = imageUrl;
            link.click();

            // Simpan transaksi ke laporan keuangan (otomatis)
            saveTransaction();

            // Kembalikan state tombol
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
        } catch (err) {
            console.error('Error saat men-generate gambar:', err);
            alert('Terjadi kesalahan saat memproses nota. Silakan coba lagi.');

            // Kembalikan state tombol
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
        }
    });

    // Inisialisasi tampilan list kosong
    renderList();
});
