// ============================================
// CUSTOMER.JS - Logic untuk halaman customer
// ============================================

// ========================================
// GLOBAL VARIABLES
// ========================================

// Variable untuk menyimpan instance QR scanner
let html5QrCodeScanner = null;

// Variable untuk menyimpan data table yang sedang dipilih
let currentTable = null;

// Variable untuk menyimpan cart items
// Cart disimpan di memory (array of objects)
let cart = [];

// Variable untuk menyimpan semua categories
let categories = [];

// Variable untuk menyimpan semua menu items
let menuItems = [];

// Variable untuk menyimpan category yang sedang dipilih (filter)
let selectedCategory = null;

// ========================================
// INITIALIZATION - Jalan otomatis ketika page load
// ========================================

/**
 * Function yang jalan otomatis ketika halaman selesai load
 * Ini adalah entry point dari semua logic customer
 */
window.onload = async function() {
    console.log('🚀 Customer page loaded');

    // Check apakah ada table yang tersimpan di sessionStorage
    // sessionStorage = tempat simpan data sementara di browser (hilang ketika close tab)
    const savedTable = sessionStorage.getItem('currentTable');
    if (savedTable) {
        // Jika ada, parse JSON string jadi object
        currentTable = JSON.parse(savedTable);
        // Tampilkan table info dan load menu
        showTableInfo();
        await loadCategories();
        await loadMenuItems();
    }

    // Check apakah ada cart yang tersimpan di localStorage
    // localStorage = tempat simpan data permanen di browser (tidak hilang ketika close tab)
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
};

// ========================================
// QR SCANNER FUNCTIONS
// ========================================

/**
 * Function untuk start QR scanner
 * Menggunakan library html5-qrcode
 */
function startQrScanner() {
    console.log('📷 Starting QR scanner...');

    // Ambil element qr-reader dari HTML
    const qrReaderElement = document.getElementById('qr-reader');

    // Inisialisasi Html5QrcodeScanner dengan config
    html5QrCodeScanner = new Html5QrcodeScanner(
        "qr-reader", // ID element untuk render scanner
        {
            fps: 10,                    // Frame per second (semakin tinggi semakin smooth)
            qrbox: { width: 250, height: 250 }, // Ukuran kotak scan
            aspectRatio: 1.0,           // Ratio camera
            showTorchButtonIfSupported: true // Tampilkan button flash jika device support
        },
        false // verbose mode (false = tidak banyak log di console)
    );

    // Render scanner dan set callback function untuk success & error
    html5QrCodeScanner.render(
        onScanSuccess,  // Function yang dipanggil ketika berhasil scan
        onScanError     // Function yang dipanggil ketika error scan
    );

    // Toggle visibility button start/stop
    document.getElementById('start-scan-btn').classList.add('hidden');
    document.getElementById('stop-scan-btn').classList.remove('hidden');
}

/**
 * Function untuk stop QR scanner
 */
function stopQrScanner() {
    console.log('🛑 Stopping QR scanner...');

    if (html5QrCodeScanner) {
        // Stop scanner dan clear element
        html5QrCodeScanner.clear();
        html5QrCodeScanner = null;
    }

    // Toggle visibility button
    document.getElementById('start-scan-btn').classList.remove('hidden');
    document.getElementById('stop-scan-btn').classList.add('hidden');
}

/**
 * Callback function ketika QR code berhasil di-scan
 * @param {string} decodedText - Text dari QR code yang di-scan
 * @param {object} decodedResult - Object result dari scanner (berisi format, dll)
 */
async function onScanSuccess(decodedText, decodedResult) {
    console.log('✅ QR Code detected:', decodedText);

    // Stop scanner
    stopQrScanner();

    // Parse table number dari QR code
    // Asumsi: QR code berisi angka table number (contoh: "1", "5", "10")
    const tableNumber = parseInt(decodedText);

    // Validasi apakah table number valid
    if (isNaN(tableNumber) || tableNumber < 1) {
        showErrorAlert('QR Code tidak valid. Harap scan QR code meja yang benar.');
        return;
    }

    // Fetch table data dari API berdasarkan table number
    await fetchTableByNumber(tableNumber);
}

/**
 * Callback function ketika scan error (bisa diabaikan, karena scan terus menerus akan error sampai detect QR)
 * @param {string} errorMessage - Pesan error
 */
function onScanError(errorMessage) {
    // Tidak perlu log error karena terlalu banyak (setiap frame yang tidak detect QR akan error)
    // console.log('Scan error:', errorMessage);
}

/**
 * Function untuk input table number secara manual (tanpa scan QR)
 */
async function manualTableInput() {
    // Ambil value dari input
    const input = document.getElementById('manual-table-input');
    const tableNumber = parseInt(input.value);

    // Validasi
    if (isNaN(tableNumber) || tableNumber < 1) {
        showErrorAlert('Nomor meja tidak valid');
        return;
    }

    // Fetch table data
    await fetchTableByNumber(tableNumber);
}

/**
 * Function untuk fetch table data dari API berdasarkan table number
 * @param {number} tableNumber - Nomor meja
 */
async function fetchTableByNumber(tableNumber) {
    try {
        // Show loading
        showLoading('scanner-section');

        // Hit API endpoint: GET /tables/by-number/:tableNumber
        const response = await apiGet(`/tables/by-number/${tableNumber}`);

        // Simpan data table ke variable global
        currentTable = response.data;

        // Simpan juga ke sessionStorage agar tidak hilang ketika refresh
        sessionStorage.setItem('currentTable', JSON.stringify(currentTable));

        // Hide scanner section, show table info
        document.getElementById('scanner-section').classList.add('hidden');
        showTableInfo();

        // Load categories dan menu items
        await loadCategories();
        await loadMenuItems();

        // Show success message
        showSuccess(`Berhasil! Anda di Meja ${currentTable.tableNumber}`);

    } catch (error) {
        console.error('Error fetching table:', error);
        showErrorAlert(error.message || 'Meja tidak ditemukan');

        // Reload scanner section
        location.reload();
    }
}

/**
 * Function untuk show table info setelah scan/input table number
 */
function showTableInfo() {
    // Update text di HTML
    document.getElementById('current-table').textContent = `Meja ${currentTable.tableNumber}`;

    // Show section table info
    document.getElementById('table-info').classList.remove('hidden');
}

/**
 * Function untuk ganti meja (clear current table dan reload)
 */
function changeTable() {
    // Konfirmasi dulu
    if (!confirm('Ganti meja akan menghapus keranjang. Lanjutkan?')) {
        return;
    }

    // Clear data
    sessionStorage.removeItem('currentTable');
    localStorage.removeItem('cart');
    cart = [];
    currentTable = null;

    // Reload page
    location.reload();
}

// ========================================
// MENU FUNCTIONS
// ========================================

/**
 * Function untuk load categories dari API
 */
async function loadCategories() {
    try {
        console.log('📂 Loading categories...');

        // Hit API endpoint: GET /menu/categories
        const response = await apiGet('/menu/categories');

        // Simpan ke variable global
        categories = response.data;

        // Render category tabs
        renderCategoryTabs();

        // Show category section
        document.getElementById('category-section').classList.remove('hidden');

    } catch (error) {
        console.error('Error loading categories:', error);
        showErrorAlert('Gagal memuat kategori menu');
    }
}

/**
 * Function untuk render category tabs (button-button category)
 */
function renderCategoryTabs() {
    const container = document.getElementById('category-tabs');

    // Clear container
    container.innerHTML = '';

    // Button "Semua" (untuk show all items tanpa filter)
    const allButton = document.createElement('button');
    allButton.textContent = 'Semua';
    allButton.className = 'px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ' +
        (selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300');
    allButton.onclick = () => filterByCategory(null);
    container.appendChild(allButton);

    // Loop categories dan buat button untuk setiap category
    categories.forEach(category => {
        const button = document.createElement('button');
        button.textContent = category.name;
        // Add class active jika category ini sedang dipilih
        button.className = 'px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ' +
            (selectedCategory === category.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300');

        // Set onclick handler
        button.onclick = () => filterByCategory(category.id);

        container.appendChild(button);
    });
}

/**
 * Function untuk filter menu items berdasarkan category
 * @param {string|null} categoryId - ID category, atau null untuk show semua
 */
function filterByCategory(categoryId) {
    // Update selected category
    selectedCategory = categoryId;

    // Re-render category tabs (untuk update active state)
    renderCategoryTabs();

    // Re-render menu items dengan filter
    renderMenuItems();
}

/**
 * Function untuk load menu items dari API
 */
async function loadMenuItems() {
    try {
        console.log('🍽️ Loading menu items...');

        // Hit API endpoint: GET /menu/items?only_available=true
        // Query param only_available=true untuk show hanya yang available
        const response = await apiGet('/menu/items?only_available=true');

        // Simpan ke variable global
        menuItems = response.data;

        // Render menu items
        renderMenuItems();

        // Show menu section
        document.getElementById('menu-section').classList.remove('hidden');

    } catch (error) {
        console.error('Error loading menu items:', error);
        showErrorAlert('Gagal memuat menu');
    }
}

/**
 * Function untuk render menu items (cards menu)
 */
function renderMenuItems() {
    const container = document.getElementById('menu-items');

    // Filter items berdasarkan selected category
    const filteredItems = selectedCategory === null
        ? menuItems  // Tampilkan semua jika tidak ada filter
        : menuItems.filter(item => item.categoryId === selectedCategory);

    // Clear container
    container.innerHTML = '';

    // Jika tidak ada items
    if (filteredItems.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-500">
                <p class="text-xl">Tidak ada menu tersedia</p>
            </div>
        `;
        return;
    }

    // Loop filtered items dan buat card untuk setiap item
    filteredItems.forEach(item => {
        // Create card element
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow';

        // Set innerHTML (isi card)
        card.innerHTML = `
            <!-- Image placeholder (bisa diganti dengan real image) -->
            <div class="h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <span class="text-6xl">🍽️</span>
            </div>

            <!-- Card Body -->
            <div class="p-4">
                <!-- Item Name -->
                <h4 class="font-bold text-lg text-gray-800 mb-2">${item.name}</h4>

                <!-- Category Badge -->
                <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mb-2">
                    ${item.category?.name || 'Tanpa Kategori'}
                </span>

                <!-- Price & Stock -->
                <div class="flex justify-between items-center mb-3">
                    <span class="text-xl font-bold text-blue-600">${formatRupiah(item.price)}</span>
                    <span class="text-sm text-gray-600">Stok: ${item.stock}</span>
                </div>

                <!-- Quantity Controls & Add to Cart Button -->
                <div class="flex items-center gap-2">
                    <!-- Minus Button -->
                    <button
                        onclick="decreaseQuantity('${item.id}')"
                        class="bg-gray-200 hover:bg-gray-300 text-gray-800 w-8 h-8 rounded-lg font-bold transition-colors"
                    >
                        -
                    </button>

                    <!-- Quantity Display -->
                    <input
                        type="number"
                        id="qty-${item.id}"
                        value="1"
                        min="1"
                        max="${item.stock}"
                        class="w-16 text-center border border-gray-300 rounded-lg py-1"
                        readonly
                    >

                    <!-- Plus Button -->
                    <button
                        onclick="increaseQuantity('${item.id}', ${item.stock})"
                        class="bg-gray-200 hover:bg-gray-300 text-gray-800 w-8 h-8 rounded-lg font-bold transition-colors"
                    >
                        +
                    </button>

                    <!-- Add to Cart Button -->
                    <button
                        onclick='addToCart(${JSON.stringify(item).replace(/'/g, "&#39;")})'
                        class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors"
                    >
                        + Keranjang
                    </button>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

/**
 * Function untuk increase quantity di input
 * @param {string} itemId - ID menu item
 * @param {number} maxStock - Maximum stock available
 */
function increaseQuantity(itemId, maxStock) {
    const input = document.getElementById(`qty-${itemId}`);
    let currentValue = parseInt(input.value);

    // Check apakah sudah mencapai max stock
    if (currentValue < maxStock) {
        input.value = currentValue + 1;
    } else {
        showErrorAlert('Stok tidak mencukupi');
    }
}

/**
 * Function untuk decrease quantity di input
 * @param {string} itemId - ID menu item
 */
function decreaseQuantity(itemId) {
    const input = document.getElementById(`qty-${itemId}`);
    let currentValue = parseInt(input.value);

    // Minimum quantity adalah 1
    if (currentValue > 1) {
        input.value = currentValue - 1;
    }
}

// ========================================
// CART FUNCTIONS
// ========================================

/**
 * Function untuk add item ke cart
 * @param {object} item - Menu item object dari API
 */
function addToCart(item) {
    // Ambil quantity dari input
    const qtyInput = document.getElementById(`qty-${item.id}`);
    const quantity = parseInt(qtyInput.value);

    // Check apakah item sudah ada di cart
    const existingItemIndex = cart.findIndex(cartItem => cartItem.id === item.id);

    if (existingItemIndex > -1) {
        // Jika sudah ada, tambahkan quantity
        cart[existingItemIndex].quantity += quantity;

        // Check apakah total quantity melebihi stock
        if (cart[existingItemIndex].quantity > item.stock) {
            showErrorAlert('Stok tidak mencukupi');
            cart[existingItemIndex].quantity = item.stock;
        }
    } else {
        // Jika belum ada, tambahkan item baru ke cart
        cart.push({
            ...item,        // Spread operator: copy semua property dari item
            quantity: quantity
        });
    }

    // Save cart ke localStorage
    localStorage.setItem('cart', JSON.stringify(cart));

    // Update UI
    updateCartUI();

    // Reset quantity input ke 1
    qtyInput.value = 1;

    // Show success message
    showSuccess(`${item.name} ditambahkan ke keranjang`);
}

/**
 * Function untuk update cart UI (badge count, cart items list, total price)
 */
function updateCartUI() {
    // Update badge count di navbar
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').textContent = totalItems;

    // Update cart items list
    renderCartItems();

    // Calculate & update total price
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('cart-total').textContent = formatRupiah(totalPrice);

    // Enable/disable checkout button
    const checkoutBtn = document.getElementById('checkout-btn');
    if (cart.length > 0) {
        checkoutBtn.disabled = false;
    } else {
        checkoutBtn.disabled = true;
    }
}

/**
 * Function untuk render cart items di cart sidebar
 */
function renderCartItems() {
    const container = document.getElementById('cart-items');

    // Jika cart kosong
    if (cart.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Keranjang kosong</p>';
        return;
    }

    // Clear container
    container.innerHTML = '';

    // Loop cart items dan buat card untuk setiap item
    cart.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'bg-gray-50 rounded-lg p-3 mb-3';

        itemDiv.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-800">${item.name}</h4>
                    <p class="text-sm text-gray-600">${formatRupiah(item.price)} × ${item.quantity}</p>
                </div>
                <!-- Remove button -->
                <button
                    onclick="removeFromCart('${item.id}')"
                    class="text-red-500 hover:text-red-700"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <!-- Quantity controls -->
            <div class="flex items-center gap-2">
                <button
                    onclick="updateCartItemQuantity('${item.id}', ${item.quantity - 1})"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 w-7 h-7 rounded text-sm font-bold"
                >
                    -
                </button>
                <span class="w-12 text-center font-semibold">${item.quantity}</span>
                <button
                    onclick="updateCartItemQuantity('${item.id}', ${item.quantity + 1}, ${item.stock})"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 w-7 h-7 rounded text-sm font-bold"
                >
                    +
                </button>
            </div>

            <!-- Subtotal -->
            <div class="mt-2 text-right">
                <span class="font-bold text-blue-600">${formatRupiah(item.price * item.quantity)}</span>
            </div>
        `;

        container.appendChild(itemDiv);
    });
}

/**
 * Function untuk update quantity item di cart
 * @param {string} itemId - ID menu item
 * @param {number} newQuantity - Quantity baru
 * @param {number} maxStock - Maximum stock (optional)
 */
function updateCartItemQuantity(itemId, newQuantity, maxStock = 999) {
    // Cari item di cart
    const itemIndex = cart.findIndex(item => item.id === itemId);

    if (itemIndex === -1) return;

    // Validasi quantity
    if (newQuantity < 1) {
        // Jika quantity < 1, remove item
        removeFromCart(itemId);
        return;
    }

    if (newQuantity > maxStock) {
        showErrorAlert('Stok tidak mencukupi');
        return;
    }

    // Update quantity
    cart[itemIndex].quantity = newQuantity;

    // Save ke localStorage
    localStorage.setItem('cart', JSON.stringify(cart));

    // Update UI
    updateCartUI();
}

/**
 * Function untuk remove item dari cart
 * @param {string} itemId - ID menu item
 */
function removeFromCart(itemId) {
    // Filter cart (remove item dengan id yang sama)
    cart = cart.filter(item => item.id !== itemId);

    // Save ke localStorage
    localStorage.setItem('cart', JSON.stringify(cart));

    // Update UI
    updateCartUI();

    showSuccess('Item dihapus dari keranjang');
}

/**
 * Function untuk toggle cart sidebar (open/close)
 */
function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');

    // Check apakah sidebar sedang terbuka (tidak ada class translate-x-full)
    if (sidebar.classList.contains('translate-x-full')) {
        // Open sidebar: remove class translate-x-full
        sidebar.classList.remove('translate-x-full');
    } else {
        // Close sidebar: add class translate-x-full
        sidebar.classList.add('translate-x-full');
    }
}

// ========================================
// CHECKOUT FUNCTIONS
// ========================================

/**
 * Function untuk buka checkout modal
 */
function checkout() {
    // Validasi: harus ada table
    if (!currentTable) {
        showErrorAlert('Harap pilih meja terlebih dahulu');
        return;
    }

    // Validasi: cart tidak boleh kosong
    if (cart.length === 0) {
        showErrorAlert('Keranjang masih kosong');
        return;
    }

    // Update modal content
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    document.getElementById('modal-item-count').textContent = totalItems;
    document.getElementById('modal-total').textContent = formatRupiah(totalPrice);

    // Show modal
    document.getElementById('checkout-modal').classList.remove('hidden');

    // Close cart sidebar
    toggleCart();
}

/**
 * Function untuk close checkout modal
 */
function closeCheckoutModal() {
    document.getElementById('checkout-modal').classList.add('hidden');
}

/**
 * Function untuk confirm order dan kirim ke backend
 */
async function confirmOrder() {
    try {
        // Disable button untuk prevent double click
        const confirmBtn = document.getElementById('confirm-order-btn');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';

        // Get selected payment method
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

        // Prepare order data sesuai format API
        const orderData = {
            tableId: currentTable.id,
            items: cart.map(item => ({
                menuItemId: item.id,
                quantity: item.quantity
            }))
        };

        console.log('🛒 Creating order:', orderData);

        // Hit API: POST /orders
        const orderResponse = await apiPost('/orders', orderData);

        console.log('✅ Order created:', orderResponse);

        // Setelah order dibuat, langsung bayar
        // Hit API: POST /orders/:id/pay
        const payResponse = await apiPost(`/orders/${orderResponse.data.id}/pay`, {
            method: paymentMethod
        });

        console.log('✅ Payment processed:', payResponse);

        // Clear cart
        cart = [];
        localStorage.removeItem('cart');
        updateCartUI();

        // Close checkout modal
        closeCheckoutModal();

        // Show success modal
        showSuccessModal(orderResponse.data.id, paymentMethod);

        // Re-enable button
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Konfirmasi';

    } catch (error) {
        console.error('Error creating order:', error);
        showErrorAlert(error.message || 'Gagal membuat pesanan');

        // Re-enable button
        const confirmBtn = document.getElementById('confirm-order-btn');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Konfirmasi';
    }
}

/**
 * Function untuk show success modal setelah order berhasil
 * @param {string} orderId - ID order yang baru dibuat
 * @param {string} paymentMethod - Metode pembayaran (cash/qris)
 */
function showSuccessModal(orderId, paymentMethod) {
    // Set order ID
    document.getElementById('order-id').textContent = orderId;

    // Set payment instructions berdasarkan method
    const instructionsDiv = document.getElementById('payment-instructions');

    if (paymentMethod === 'cash') {
        instructionsDiv.innerHTML = `
            <div class="bg-blue-50 p-4 rounded-lg">
                <p class="font-semibold text-blue-800 mb-2">💵 Pembayaran Cash</p>
                <p class="text-sm text-blue-700">Silakan bayar di kasir saat pesanan Anda datang.</p>
            </div>
        `;
    } else {
        instructionsDiv.innerHTML = `
            <div class="bg-blue-50 p-4 rounded-lg">
                <p class="font-semibold text-blue-800 mb-2">📱 Pembayaran QRIS</p>
                <p class="text-sm text-blue-700">Silakan scan QRIS code di meja atau kasir untuk melakukan pembayaran.</p>
            </div>
        `;
    }

    // Show modal
    document.getElementById('success-modal').classList.remove('hidden');
}

/**
 * Function untuk close success modal
 */
function closeSuccessModal() {
    document.getElementById('success-modal').classList.add('hidden');

    // Optional: Reload page untuk fresh start
    // location.reload();
}
