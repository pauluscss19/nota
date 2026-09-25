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

    // Fungsi untuk menyimpan transaksi ke Firebase (otomatis saat download nota)
    async function saveTransaction() {
        const custCode = customerCodeInput.value.trim() || 'Baru';
        let total = 0;
        items.forEach(item => { total += item.price; });

        const transaction = {
            customerCode: custCode,
            items: items.map(item => ({ name: item.name, price: item.price })),
            total: total,
            date: new Date().toISOString(),
            status: 'belum_bayar'
        };

        try {
            await db.collection('transactions').add(transaction);
            console.log('Transaksi berhasil disimpan ke Firebase!');
        } catch (error) {
            console.error('Error menyimpan ke Firebase:', error);
            alert('Gagal menyimpan data ke server. Pastikan Firebase Config sudah benar.');
        }
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
            await saveTransaction();

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

    // ================= FITUR REKOMENDASI HARGA =================
    const docUpload = document.getElementById('docUpload');
    const docResult = document.getElementById('docResult');

    function calculateRecommendedPrice(wordCount) {
        if (wordCount <= 300) {
            return 10;
        } else if (wordCount <= 500) {
            // Dari 300 ke 500 (selisih 200 kata) harganya naik 5K
            const rate = 5 / 200; 
            const price = 10 + ((wordCount - 300) * rate);
            return Math.round(price);
        } else if (wordCount <= 3000) {
            // Dari 500 ke 3000 harganya naik 10K per 500 kata
            const rate = 10 / 500;
            const price = 15 + ((wordCount - 500) * rate);
            return Math.round(price);
        } else {
            // Di atas 3000 kata harganya naik 5K per 500 kata
            const rate = 5 / 500;
            const price = 65 + ((wordCount - 3000) * rate);
            return Math.round(price);
        }
    }

    function countWords(text) {
        // Hapus whitespace berlebih dan hitung kata
        const words = text.trim().split(/\s+/);
        return text.trim() === '' ? 0 : words.length;
    }

    if (docUpload) {
        docUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) {
                docResult.style.display = 'none';
                return;
            }

            docResult.style.display = 'block';
            docResult.textContent = 'Membaca dokumen...';
            docResult.style.color = '#4f46e5';

            try {
                let text = '';

                if (file.name.endsWith('.txt')) {
                    // Ekstrak teks dari file .txt
                    text = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = (e) => reject(e);
                        reader.readAsText(file);
                    });
                } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
                    // Ekstrak teks dari file .docx menggunakan mammoth
                    if (typeof mammoth === 'undefined') {
                        throw new Error("Library Mammoth.js belum dimuat.");
                    }
                    const arrayBuffer = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = (e) => reject(e);
                        reader.readAsArrayBuffer(file);
                    });

                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    text = result.value;
                } else {
                    throw new Error("Format file tidak didukung. Harap upload .txt atau .docx");
                }

                const wordCount = countWords(text);
                const price = calculateRecommendedPrice(wordCount);

                docResult.innerHTML = `Jumlah Kata: <strong>${wordCount} kata</strong> <br/> Rekomendasi Harga: <strong>${price}K</strong>`;
                docResult.style.color = '#059669'; // Hijau sukses

                // Otomatis isi ke form
                itemNameInput.value = `Tugas (${wordCount} kata)`;
                itemPriceInput.value = price; 
                
            } catch (err) {
                console.error(err);
                docResult.textContent = `Error: ${err.message}`;
                docResult.style.color = '#dc2626'; // Merah error
            }
        });
    }

    // Inisialisasi tampilan list kosong
    renderList();
});
