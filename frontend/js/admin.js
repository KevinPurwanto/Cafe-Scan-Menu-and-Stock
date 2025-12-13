// ============================================
// ADMIN.JS - Logic untuk halaman admin
// ============================================

// ========================================
// GLOBAL VARIABLES
// ========================================

// Simpan API key di memory setelah login
let adminApiKey = null;

// Simpan data untuk caching
let orders = [];
let categories = [];
let menuItems = [];
let tables = [];

// Track current active tab
let currentTab = 'orders';

// ========================================
// INITIALIZATION
// ========================================

/**
 * Function yang jalan otomatis ketika page load
 */
window.onload = function() {
    console.log('🔐 Admin page loaded');

    // Check apakah admin sudah login sebelumnya (tersimpan di sessionStorage)
    const savedApiKey = sessionStorage.getItem('adminApiKey');
    if (savedApiKey) {
        adminApiKey = savedApiKey;
        showDashboard();
    }

    // Set default date untuk report (hari ini)
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('report-date');
    if (dateInput) {
        dateInput.value = today;
    }
};

// ========================================
// LOGIN & AUTHENTICATION
// ========================================

/**
 * Function untuk handle login form submit
 * @param {Event} event - Form submit event
 */
async function login(event) {
    // Prevent default form behavior (refresh page)
    event.preventDefault();

    // Ambil API key dari input
    const apiKeyInput = document.getElementById('api-key-input');
    const enteredApiKey = apiKeyInput.value.trim();

    // Validasi: API key tidak boleh kosong
    if (!enteredApiKey) {
        showErrorAlert('API Key tidak boleh kosong');
        return;
    }

    try {
        // Test API key dengan hit endpoint admin (GET /tables)
        // Jika API key salah, akan return 401 Unauthorized
        const response = await apiGet('/tables', {
            'x-api-key': enteredApiKey
        });

        // Jika berhasil, simpan API key
        adminApiKey = enteredApiKey;

        // Simpan ke sessionStorage agar tidak perlu login lagi ketika refresh
        sessionStorage.setItem('adminApiKey', adminApiKey);

        // Show dashboard
        showDashboard();

        // Show success message
        showSuccess('Login berhasil!');

    } catch (error) {
        console.error('Login error:', error);
        showErrorAlert('API Key salah atau backend tidak tersedia');
    }
}

/**
 * Function untuk logout admin
 */
function logout() {
    // Konfirmasi dulu
    if (!confirm('Yakin ingin logout?')) {
        return;
    }

    // Clear API key dari memory dan sessionStorage
    adminApiKey = null;
    sessionStorage.removeItem('adminApiKey');

    // Hide dashboard, show login screen
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');

    showSuccess('Logout berhasil');
}

/**
 * Function untuk show dashboard setelah login
 */
async function showDashboard() {
    // Hide login screen
    document.getElementById('login-screen').classList.add('hidden');

    // Show dashboard
    document.getElementById('admin-dashboard').classList.remove('hidden');

    // Load initial data untuk tab pertama (orders)
    showTab('orders');
}

// ========================================
// TAB NAVIGATION
// ========================================

/**
 * Function untuk switch antar tab
 * @param {string} tabName - Nama tab (orders, menu, tables, reports)
 */
async function showTab(tabName) {
    console.log('📑 Switching to tab:', tabName);

    // Update current tab
    currentTab = tabName;

    // Hide semua tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });

    // Show tab yang dipilih
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    // Update active state di tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-indigo-600', 'border-indigo-600');
        btn.classList.add('text-gray-600', 'border-transparent');
    });

    // Set active state untuk tab yang dipilih
    event.target.classList.remove('text-gray-600', 'border-transparent');
    event.target.classList.add('text-indigo-600', 'border-indigo-600');

    // Load data sesuai tab
    switch (tabName) {
        case 'orders':
            await loadOrders();
            break;
        case 'menu':
            await loadCategories();
            await loadMenuItems();
            break;
        case 'tables':
            await loadTables();
            break;
        case 'reports':
            // Report load on-demand ketika user click button
            break;
    }
}

// ========================================
// ORDERS TAB FUNCTIONS
// ========================================

/**
 * Function untuk load orders dari API
 */
async function loadOrders() {
    try {
        showLoading('orders-list');

        // Get selected status filter
        const statusFilter = document.getElementById('order-status-filter').value;

        // Build query string
        const queryString = statusFilter ? `?status=${statusFilter}` : '';

        // Hit API: GET /orders (dengan auth header)
        const response = await apiGet(`/orders${queryString}`, {
            'x-api-key': adminApiKey
        });

        orders = response.data;

        // Render orders
        renderOrders();

    } catch (error) {
        console.error('Error loading orders:', error);
        showError('orders-list', error.message || 'Gagal memuat orders');
    }
}

/**
 * Function untuk render orders list
 */
function renderOrders() {
    const container = document.getElementById('orders-list');

    if (orders.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Tidak ada orders</p>';
        return;
    }

    container.innerHTML = '';

    // Loop orders dan buat card untuk setiap order
    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow';

        // Status badge color
        let statusColor = 'bg-yellow-100 text-yellow-800';
        if (order.status === 'paid') statusColor = 'bg-green-100 text-green-800';
        if (order.status === 'cancelled') statusColor = 'bg-red-100 text-red-800';

        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <p class="text-sm text-gray-500">Order ID</p>
                    <p class="font-mono text-sm font-semibold text-gray-800">${order.id.substring(0, 8)}...</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColor}">
                    ${order.status.toUpperCase()}
                </span>
            </div>

            <div class="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                    <span class="text-gray-600">Meja:</span>
                    <span class="font-semibold ml-1">${order.table?.tableNumber || '-'}</span>
                </div>
                <div>
                    <span class="text-gray-600">Items:</span>
                    <span class="font-semibold ml-1">${order._count?.items || 0}</span>
                </div>
                <div>
                    <span class="text-gray-600">Total:</span>
                    <span class="font-semibold ml-1 text-blue-600">${formatRupiah(order.totalPrice)}</span>
                </div>
                <div>
                    <span class="text-gray-600">Payment:</span>
                    <span class="font-semibold ml-1">${order.paymentMethod || '-'}</span>
                </div>
            </div>

            <div class="text-xs text-gray-500">
                ${formatDate(order.createdAt)}
            </div>
        `;

        container.appendChild(card);
    });
}

// ========================================
// MENU TAB FUNCTIONS
// ========================================

/**
 * Function untuk load categories dari API
 */
async function loadCategories() {
    try {
        const response = await apiGet('/menu/categories');
        categories = response.data;
        renderCategories();
    } catch (error) {
        console.error('Error loading categories:', error);
        document.getElementById('categories-list').innerHTML = '<p class="text-red-500 text-sm">Error loading</p>';
    }
}

/**
 * Function untuk render categories list
 */
function renderCategories() {
    const container = document.getElementById('categories-list');

    if (categories.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm py-4 text-center">Tidak ada kategori</p>';
        return;
    }

    container.innerHTML = '';

    categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2';

        item.innerHTML = `
            <div>
                <p class="font-semibold text-gray-800">${cat.name}</p>
                <p class="text-xs text-gray-500">${cat._count?.items || 0} items</p>
            </div>
            <button
                onclick="deleteCategory('${cat.id}')"
                class="text-red-500 hover:text-red-700 text-sm"
            >
                Hapus
            </button>
        `;

        container.appendChild(item);
    });
}

/**
 * Function untuk show form add category
 */
function showAddCategoryForm() {
    document.getElementById('modal-title').textContent = 'Tambah Kategori';

    document.getElementById('modal-body').innerHTML = `
        <form onsubmit="submitAddCategory(event)" class="space-y-4">
            <div>
                <label class="block text-gray-700 font-semibold mb-2">Nama Kategori</label>
                <input
                    type="text"
                    id="category-name"
                    placeholder="Contoh: Minuman"
                    required
                    class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
            </div>
            <button
                type="submit"
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg"
            >
                Tambah
            </button>
        </form>
    `;

    document.getElementById('modal').classList.remove('hidden');
}

/**
 * Function untuk submit add category form
 */
async function submitAddCategory(event) {
    event.preventDefault();

    const name = document.getElementById('category-name').value.trim();

    try {
        await apiPost('/menu/categories', { name }, {
            'x-api-key': adminApiKey
        });

        showSuccess('Kategori berhasil ditambahkan');
        closeModal();
        await loadCategories();
        await loadMenuItems();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal menambahkan kategori');
    }
}

/**
 * Function untuk delete category
 */
async function deleteCategory(categoryId) {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return;

    try {
        await apiDelete(`/menu/categories/${categoryId}`, {
            'x-api-key': adminApiKey
        });

        showSuccess('Kategori berhasil dihapus');
        await loadCategories();
        await loadMenuItems();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal menghapus kategori');
    }
}

/**
 * Function untuk load menu items dari API
 */
async function loadMenuItems() {
    try {
        const response = await apiGet('/menu/items?only_available=false');
        menuItems = response.data;
        renderMenuItems();
    } catch (error) {
        console.error('Error loading menu items:', error);
        document.getElementById('menu-items-list').innerHTML = '<p class="text-red-500 text-sm">Error loading</p>';
    }
}

/**
 * Function untuk render menu items list
 */
function renderMenuItems() {
    const container = document.getElementById('menu-items-list');

    if (menuItems.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm py-4 text-center">Tidak ada menu items</p>';
        return;
    }

    // Tampilkan hanya 5 items pertama (untuk tidak terlalu panjang)
    // Bisa ditambahkan pagination di versi production
    const displayItems = menuItems.slice(0, 5);

    container.innerHTML = '';

    displayItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'p-3 bg-gray-50 rounded-lg mb-2';

        itemDiv.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <p class="font-semibold text-gray-800">${item.name}</p>
                    <p class="text-xs text-gray-500">${item.category?.name || 'No category'}</p>
                </div>
                <button
                    onclick="deleteMenuItem('${item.id}')"
                    class="text-red-500 hover:text-red-700 text-sm"
                >
                    Hapus
                </button>
            </div>
            <div class="flex justify-between items-center text-sm">
                <span class="text-blue-600 font-semibold">${formatRupiah(item.price)}</span>
                <span class="text-gray-600">Stok: ${item.stock}</span>
                <span class="${item.isAvailable ? 'text-green-600' : 'text-red-600'} text-xs">
                    ${item.isAvailable ? '✓ Available' : '✗ Not Available'}
                </span>
            </div>
        `;

        container.appendChild(itemDiv);
    });

    // Show info jika ada lebih dari 5 items
    if (menuItems.length > 5) {
        const info = document.createElement('p');
        info.className = 'text-center text-sm text-gray-500 mt-3';
        info.textContent = `Showing 5 of ${menuItems.length} items`;
        container.appendChild(info);
    }
}

/**
 * Function untuk show form add menu item
 */
function showAddItemForm() {
    document.getElementById('modal-title').textContent = 'Tambah Menu Item';

    // Generate category options
    const categoryOptions = categories.map(cat =>
        `<option value="${cat.id}">${cat.name}</option>`
    ).join('');

    document.getElementById('modal-body').innerHTML = `
        <form onsubmit="submitAddMenuItem(event)" class="space-y-3">
            <div>
                <label class="block text-gray-700 font-semibold mb-1 text-sm">Nama Menu</label>
                <input
                    type="text"
                    id="item-name"
                    placeholder="Contoh: Kopi Susu"
                    required
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
            </div>
            <div>
                <label class="block text-gray-700 font-semibold mb-1 text-sm">Kategori</label>
                <select id="item-category" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Tanpa Kategori</option>
                    ${categoryOptions}
                </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-gray-700 font-semibold mb-1 text-sm">Harga</label>
                    <input
                        type="number"
                        id="item-price"
                        placeholder="15000"
                        required
                        min="0"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                </div>
                <div>
                    <label class="block text-gray-700 font-semibold mb-1 text-sm">Stok</label>
                    <input
                        type="number"
                        id="item-stock"
                        placeholder="100"
                        required
                        min="0"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                </div>
            </div>
            <div>
                <label class="flex items-center">
                    <input type="checkbox" id="item-available" checked class="mr-2">
                    <span class="text-sm text-gray-700">Available untuk dijual</span>
                </label>
            </div>
            <button
                type="submit"
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-sm"
            >
                Tambah
            </button>
        </form>
    `;

    document.getElementById('modal').classList.remove('hidden');
}

/**
 * Function untuk submit add menu item form
 */
async function submitAddMenuItem(event) {
    event.preventDefault();

    const data = {
        name: document.getElementById('item-name').value.trim(),
        categoryId: document.getElementById('item-category').value || undefined,
        price: parseInt(document.getElementById('item-price').value),
        stock: parseInt(document.getElementById('item-stock').value),
        isAvailable: document.getElementById('item-available').checked
    };

    try {
        await apiPost('/menu/items', data, {
            'x-api-key': adminApiKey
        });

        showSuccess('Menu item berhasil ditambahkan');
        closeModal();
        await loadMenuItems();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal menambahkan menu item');
    }
}

/**
 * Function untuk delete menu item
 */
async function deleteMenuItem(itemId) {
    if (!confirm('Yakin ingin menghapus menu item ini?')) return;

    try {
        await apiDelete(`/menu/items/${itemId}`, {
            'x-api-key': adminApiKey
        });

        showSuccess('Menu item berhasil dihapus');
        await loadMenuItems();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal menghapus menu item');
    }
}

// ========================================
// TABLES TAB FUNCTIONS
// ========================================

/**
 * Function untuk load tables dari API
 */
async function loadTables() {
    try {
        showLoading('tables-list');

        const response = await apiGet('/tables', {
            'x-api-key': adminApiKey
        });

        tables = response.data;
        renderTables();

    } catch (error) {
        console.error('Error loading tables:', error);
        showError('tables-list', error.message || 'Gagal memuat tables');
    }
}

/**
 * Function untuk render tables list
 */
function renderTables() {
    const container = document.getElementById('tables-list');

    if (tables.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Tidak ada meja</p>';
        return;
    }

    container.innerHTML = '';

    // Create grid container
    const grid = document.createElement('div');
    grid.className = 'grid md:grid-cols-3 gap-4';

    tables.forEach(table => {
        const card = document.createElement('div');
        card.className = 'border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow';

        card.innerHTML = `
            <div class="text-center mb-3">
                <p class="text-3xl mb-2">🪑</p>
                <p class="text-2xl font-bold text-gray-800">Meja ${table.tableNumber}</p>
            </div>

            <div class="text-sm text-gray-600 mb-3">
                <p><span class="font-semibold">QR Code:</span> ${table.qrCode}</p>
                <p>
                    <span class="font-semibold">Status:</span>
                    <span class="${table.isActive ? 'text-green-600' : 'text-red-600'}">
                        ${table.isActive ? '✓ Active' : '✗ Inactive'}
                    </span>
                </p>
            </div>

            <button
                onclick="deleteTable('${table.id}')"
                class="w-full bg-red-500 hover:bg-red-600 text-white text-sm py-2 rounded-lg"
            >
                Hapus Meja
            </button>
        `;

        grid.appendChild(card);
    });

    container.appendChild(grid);
}

/**
 * Function untuk show form add table
 */
function showAddTableForm() {
    document.getElementById('modal-title').textContent = 'Tambah Meja';

    document.getElementById('modal-body').innerHTML = `
        <form onsubmit="submitAddTable(event)" class="space-y-4">
            <div>
                <label class="block text-gray-700 font-semibold mb-2">Nomor Meja</label>
                <input
                    type="number"
                    id="table-number"
                    placeholder="Contoh: 1"
                    required
                    min="1"
                    class="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
            </div>
            <div>
                <label class="block text-gray-700 font-semibold mb-2">QR Code</label>
                <input
                    type="text"
                    id="table-qrcode"
                    placeholder="Contoh: QR_TABLE_1"
                    required
                    class="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                <p class="text-xs text-gray-500 mt-1">QR Code akan di-scan oleh customer</p>
            </div>
            <div>
                <label class="flex items-center">
                    <input type="checkbox" id="table-active" checked class="mr-2">
                    <span class="text-gray-700">Meja aktif</span>
                </label>
            </div>
            <button
                type="submit"
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg"
            >
                Tambah
            </button>
        </form>
    `;

    document.getElementById('modal').classList.remove('hidden');
}

/**
 * Function untuk submit add table form
 */
async function submitAddTable(event) {
    event.preventDefault();

    const data = {
        tableNumber: parseInt(document.getElementById('table-number').value),
        qrCode: document.getElementById('table-qrcode').value.trim(),
        isActive: document.getElementById('table-active').checked
    };

    try {
        await apiPost('/tables', data, {
            'x-api-key': adminApiKey
        });

        showSuccess('Meja berhasil ditambahkan');
        closeModal();
        await loadTables();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal menambahkan meja');
    }
}

/**
 * Function untuk delete table
 */
async function deleteTable(tableId) {
    if (!confirm('Yakin ingin menghapus meja ini?')) return;

    try {
        await apiDelete(`/tables/${tableId}`, {
            'x-api-key': adminApiKey
        });

        showSuccess('Meja berhasil dihapus');
        await loadTables();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal menghapus meja');
    }
}

// ========================================
// REPORTS TAB FUNCTIONS
// ========================================

/**
 * Function untuk load daily report berdasarkan tanggal yang dipilih
 */
async function loadDailyReport() {
    try {
        showLoading('report-content');

        const date = document.getElementById('report-date').value;

        if (!date) {
            showError('report-content', 'Pilih tanggal terlebih dahulu');
            return;
        }

        // Hit API: GET /reports/daily?date=YYYY-MM-DD
        const response = await apiGet(`/reports/daily?date=${date}`, {
            'x-api-key': adminApiKey
        });

        // Render report
        renderDailyReport(response.data);

    } catch (error) {
        console.error('Error loading report:', error);
        showError('report-content', error.message || 'Gagal memuat laporan');
    }
}

/**
 * Function untuk render daily report
 */
function renderDailyReport(data) {
    const container = document.getElementById('report-content');

    container.innerHTML = `
        <!-- Summary Cards -->
        <div class="grid md:grid-cols-3 gap-4 mb-6">
            <div class="bg-blue-50 rounded-lg p-4">
                <p class="text-sm text-blue-600 font-semibold mb-1">Total Orders</p>
                <p class="text-3xl font-bold text-blue-900">${data.summary.totalOrders}</p>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
                <p class="text-sm text-green-600 font-semibold mb-1">Total Revenue</p>
                <p class="text-3xl font-bold text-green-900">${formatRupiah(data.summary.totalRevenue)}</p>
            </div>
            <div class="bg-purple-50 rounded-lg p-4">
                <p class="text-sm text-purple-600 font-semibold mb-1">Avg Order Value</p>
                <p class="text-3xl font-bold text-purple-900">${formatRupiah(data.summary.averageOrderValue)}</p>
            </div>
        </div>

        <!-- Revenue by Payment Method -->
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 class="font-bold text-gray-800 mb-3">Revenue by Payment Method</h4>
            ${Object.entries(data.revenueByMethod).map(([method, amount]) => `
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-700">${method.toUpperCase()}</span>
                    <span class="font-semibold text-gray-900">${formatRupiah(amount)}</span>
                </div>
            `).join('')}
        </div>

        <!-- Top Items -->
        <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-bold text-gray-800 mb-3">Top Selling Items</h4>
            ${data.topItems && data.topItems.length > 0 ? data.topItems.map((item, index) => `
                <div class="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 last:border-0">
                    <div class="flex items-center">
                        <span class="font-bold text-lg text-gray-400 mr-3">#${index + 1}</span>
                        <div>
                            <p class="font-semibold text-gray-800">${item.name}</p>
                            <p class="text-xs text-gray-500">${item.category}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-semibold text-gray-900">${item.quantity} sold</p>
                        <p class="text-sm text-gray-600">${formatRupiah(item.revenue)}</p>
                    </div>
                </div>
            `).join('') : '<p class="text-gray-500 text-sm">No data</p>'}
        </div>
    `;
}

// ========================================
// MODAL FUNCTIONS
// ========================================

/**
 * Function untuk close modal
 */
function closeModal(event) {
    // Jika click pada backdrop (bukan di dalam modal body), close modal
    if (!event || event.target.id === 'modal') {
        document.getElementById('modal').classList.add('hidden');
    }
}
