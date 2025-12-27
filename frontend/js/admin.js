// ============================================
// ADMIN.JS - Logic untuk halaman admin
// ============================================

// ========================================
// GLOBAL VARIABLES
// ========================================

// Simpan data admin setelah login
let adminUser = null;

// Simpan data untuk caching
let orders = [];
let categories = [];
let menuItems = [];
let tables = [];
let reportOrdersCache = [];
let confirmActionCallback = null;

// Track current active tab
let currentTab = 'orders';

// ========================================
// INITIALIZATION
// ========================================

/**
 * Function yang jalan otomatis ketika page load
 */
window.onload = function() {
    console.log('dY"? Admin page loaded');

    checkAdminSession();

    const periodSelect = document.getElementById('report-period');
    if (periodSelect) {
        renderReportInputs();
        periodSelect.addEventListener('change', renderReportInputs);
    }
};

async function checkAdminSession() {
    try {
        const response = await apiGet('/auth/admin/me');
        adminUser = response.data;
        showDashboard();
    } catch (_error) {
        // Not logged in yet.
    }
}

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

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        showErrorAlert('Username dan password wajib diisi');
        return;
    }

    try {
        const response = await apiPost('/auth/admin/login', {
            username,
            password
        });

        adminUser = response.data;

        // Show dashboard
        showDashboard();

        // Show success message
        showSuccess('Login berhasil!');

    } catch (error) {
        console.error('Login error:', error);
        showErrorAlert(error.message || 'Login gagal');
    }
}

/**
 * Function untuk logout admin
 */
function logout() {
    openConfirmModal({
        title: 'Logout',
        message: 'Yakin ingin logout dari dashboard?',
        confirmText: 'Logout',
        confirmClass: 'bg-red-500 hover:bg-red-600',
        onConfirm: () => performLogout()
    });
}

async function performLogout() {
    try {
        await apiPost('/auth/admin/logout', {});
    } catch (error) {
        console.error('Logout error:', error);
    }

    adminUser = null;

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
        const response = await apiGet(`/orders${queryString}`);

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
        if (order.status === 'validated') statusColor = 'bg-blue-100 text-blue-800';
        if (order.status === 'paid') statusColor = 'bg-green-100 text-green-800';
        if (order.status === 'served') statusColor = 'bg-teal-100 text-teal-800';
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

            <div class="mt-3 flex justify-end">
                <button
                    onclick="openOrderModal('${order.id}')"
                    class="px-3 py-1 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                >
                    Kelola
                </button>
            </div>
        `;

        container.appendChild(card);
    });
}

function openForgotPasswordModal() {
    document.getElementById('modal-title').textContent = 'Reset Password Admin';
    document.getElementById('modal-body').innerHTML = `
        <div class="space-y-4">
            <p class="text-sm text-gray-600">
                Link reset akan dikirim ke email reset yang dikonfigurasi.
            </p>
            <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2">Username Admin</label>
                <input
                    type="text"
                    id="reset-username"
                    placeholder="masukkan username"
                    class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
            </div>
            <div class="flex gap-2 pt-2">
                <button
                    type="button"
                    onclick="closeModal()"
                    class="flex-1 border border-gray-300 text-gray-700 font-semibold py-2 rounded-lg hover:bg-gray-50"
                >
                    Batal
                </button>
                <button
                    type="button"
                    onclick="sendResetEmail()"
                    class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg"
                >
                    Kirim Link
                </button>
            </div>
        </div>
    `;

    document.getElementById('modal').classList.remove('hidden');
}

async function sendResetEmail() {
    const usernameInput = document.getElementById('reset-username');
    const username = usernameInput?.value?.trim() || '';
    if (!username) {
        showErrorAlert('Username wajib diisi.');
        return;
    }

    try {
        const response = await apiPost('/auth/admin/forgot-password', { username });
        showSuccess(response.message || 'Jika email terdaftar, link reset akan dikirim.');
        closeModal();
    } catch (error) {
        showErrorAlert(error.message || 'Gagal mengirim link reset.');
    }
}

async function openOrderModal(orderId) {
    if (!adminUser) {
        showErrorAlert('Silakan login terlebih dahulu.');
        return;
    }

    document.getElementById('modal-title').textContent = 'Kelola Pesanan';
    document.getElementById('modal-body').innerHTML = `
        <div class="text-center text-gray-500 py-6">Loading...</div>
    `;
    document.getElementById('modal').classList.remove('hidden');

    try {
        await ensureMenuItemsLoaded();
        const response = await apiGet(`/orders/${orderId}`);
        renderOrderModal(response.data);
    } catch (error) {
        closeModal();
        showErrorAlert(error.message || 'Gagal memuat detail order');
    }
}

async function ensureMenuItemsLoaded() {
    if (menuItems.length > 0) return;
    const response = await apiGet('/menu/items?only_available=false');
    menuItems = response.data;
}

function renderOrderModal(order) {
    const isLocked = order.status === 'paid' || order.status === 'served' || order.status === 'cancelled';
    const canValidate = order.status === 'pending';
    const canPay = order.status === 'validated';
    const method = order.paymentMethod || 'cash';

    const availableItems = menuItems.filter(item => item.isAvailable);
    const itemOptions = availableItems.length > 0
        ? availableItems.map(item => `<option value="${item.id}">${item.name}</option>`).join('')
        : '<option value="">Tidak ada menu tersedia</option>';

    const itemsHtml = order.items.map(item => buildOrderItemRow(item, isLocked)).join('') || `
        <p class="text-sm text-gray-500 text-center py-4">Tidak ada item</p>
    `;

    document.getElementById('modal-body').innerHTML = `
        <div class="space-y-4">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-xs text-gray-500">Order ID</p>
                    <p class="font-mono text-sm font-semibold text-gray-800">${order.id}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${getOrderStatusClass(order.status)}">
                    ${order.status.toUpperCase()}
                </span>
            </div>

            <div class="grid grid-cols-2 gap-3 text-sm">
                <div><span class="text-gray-600">Meja:</span> <span class="font-semibold">${order.table?.tableNumber || '-'}</span></div>
                <div><span class="text-gray-600">Total:</span> <span class="font-semibold text-blue-600">${formatRupiah(order.totalPrice)}</span></div>
                <div><span class="text-gray-600">Payment:</span> <span class="font-semibold">${order.paymentMethod || '-'}</span></div>
                <div><span class="text-gray-600">Status:</span> <span class="font-semibold">${order.status}</span></div>
            </div>

            <div>
                <p class="text-sm font-semibold text-gray-700 mb-2">Items</p>
                <div id="order-items-list">
                    ${itemsHtml}
                </div>
            </div>

            ${isLocked ? '' : `
            <div class="bg-gray-50 rounded-lg p-3">
                <label class="block text-sm font-semibold text-gray-700 mb-2">Tambah Item</label>
                <div class="flex gap-2">
                    <select id="order-add-item" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        ${itemOptions}
                    </select>
                    <input
                        type="number"
                        id="order-add-qty"
                        min="1"
                        value="1"
                        class="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
                    >
                    <button
                        type="button"
                        onclick="addOrderItemRow()"
                        class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm"
                        ${availableItems.length === 0 ? 'disabled' : ''}
                    >
                        Tambah
                    </button>
                </div>
            </div>
            `}

            ${canPay ? `
            <div class="bg-gray-50 rounded-lg p-3">
                <label class="block text-sm font-semibold text-gray-700 mb-2">Metode Pembayaran</label>
                <select id="order-pay-method" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="cash" ${method === 'cash' ? 'selected' : ''}>Cash</option>
                    <option value="qris" ${method === 'qris' ? 'selected' : ''}>QRIS</option>
                </select>
            </div>
            ` : ''}

            <div class="flex gap-2 pt-2">
                ${isLocked ? '' : `
                <button
                    type="button"
                    onclick="saveOrderItems('${order.id}')"
                    class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg"
                >
                    Simpan Perubahan
                </button>
                `}
                ${canValidate ? `
                <button
                    type="button"
                    onclick="validateOrderById('${order.id}')"
                    class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg"
                >
                    Validasi
                </button>
                ` : ''}
                ${canPay ? `
                <button
                    type="button"
                    onclick="markOrderPaid('${order.id}')"
                    class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg"
                >
                    Tandai Paid
                </button>
                ` : ''}
            </div>
        </div>
    `;
}

function buildOrderItemRow(item, isLocked) {
    const removeButton = isLocked
        ? ''
        : `<button type="button" onclick="removeOrderItemRow('${item.menuItemId}')" class="text-red-500 text-xs">Hapus</button>`;

    return `
        <div class="flex items-center gap-2 pb-2 mb-2 border-b border-gray-200" data-menu-item-id="${item.menuItemId}">
            <div class="flex-1">
                <p class="font-semibold text-gray-800">${item.menuItem?.name || item.menuName || 'Item'}</p>
                <p class="text-xs text-gray-500">${formatRupiah(item.price)}</p>
            </div>
            <input
                type="number"
                min="0"
                value="${item.quantity}"
                class="order-item-qty w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm"
                ${isLocked ? 'disabled' : ''}
            >
            ${removeButton}
        </div>
    `;
}

function addOrderItemRow() {
    const select = document.getElementById('order-add-item');
    const qtyInput = document.getElementById('order-add-qty');
    const menuItemId = select?.value;
    const quantity = parseInt(qtyInput?.value || '0', 10);

    if (!menuItemId) {
        showErrorAlert('Pilih menu item terlebih dahulu.');
        return;
    }

    if (isNaN(quantity) || quantity < 1) {
        showErrorAlert('Quantity tidak valid.');
        return;
    }

    const list = document.getElementById('order-items-list');
    const existing = list?.querySelector(`[data-menu-item-id="${menuItemId}"]`);
    if (existing) {
        const qtyField = existing.querySelector('.order-item-qty');
        const current = parseInt(qtyField.value, 10) || 0;
        qtyField.value = current + quantity;
    } else {
        const menuItem = menuItems.find(item => item.id === menuItemId);
        if (!menuItem) {
            showErrorAlert('Menu item tidak ditemukan.');
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.innerHTML = buildOrderItemRow({
            menuItemId: menuItem.id,
            menuItem,
            price: menuItem.price,
            quantity
        }, false);
        list.appendChild(wrapper.firstElementChild);
    }

    qtyInput.value = '1';
}

function removeOrderItemRow(menuItemId) {
    const list = document.getElementById('order-items-list');
    const row = list?.querySelector(`[data-menu-item-id="${menuItemId}"]`);
    if (row) {
        row.remove();
    }
}

function collectOrderItemsFromModal() {
    const list = document.getElementById('order-items-list');
    const rows = list?.querySelectorAll('[data-menu-item-id]') || [];
    const items = [];

    rows.forEach(row => {
        const menuItemId = row.getAttribute('data-menu-item-id');
        const qtyInput = row.querySelector('.order-item-qty');
        const quantity = parseInt(qtyInput?.value || '0', 10);
        if (menuItemId && quantity > 0) {
            items.push({ menuItemId, quantity });
        }
    });

    return items;
}

async function saveOrderItems(orderId) {
    try {
        const items = collectOrderItemsFromModal();
        if (items.length === 0) {
            showErrorAlert('Minimal 1 item diperlukan.');
            return;
        }

        await apiPatch(`/orders/${orderId}/items`, { items });

        showSuccess('Order berhasil diperbarui.');
        closeModal();
        await loadOrders();
    } catch (error) {
        showErrorAlert(error.message || 'Gagal memperbarui order');
    }
}

async function validateOrderById(orderId) {
    try {
        await apiPost(`/orders/${orderId}/validate`, {});

        showSuccess('Order berhasil divalidasi.');
        closeModal();
        await loadOrders();
    } catch (error) {
        showErrorAlert(error.message || 'Gagal memvalidasi order');
    }
}

async function markOrderPaid(orderId) {
    try {
        const methodSelect = document.getElementById('order-pay-method');
        const method = methodSelect?.value || 'cash';

        await apiPost(`/orders/${orderId}/pay`, { method });

        showSuccess('Pembayaran berhasil dicatat.');
        closeModal();
        await loadOrders();
    } catch (error) {
        showErrorAlert(error.message || 'Gagal mencatat pembayaran');
    }
}

function getOrderStatusClass(status) {
    if (status === 'validated') return 'bg-blue-100 text-blue-800';
    if (status === 'paid') return 'bg-green-100 text-green-800';
    if (status === 'served') return 'bg-teal-100 text-teal-800';
    if (status === 'cancelled') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
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
        await apiPost('/menu/categories', { name });

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
function deleteCategory(categoryId) {
    openConfirmModal({
        title: 'Hapus Kategori',
        message: 'Kategori akan dihapus permanen.',
        confirmText: 'Hapus',
        onConfirm: () => confirmDeleteCategory(categoryId)
    });
}

async function confirmDeleteCategory(categoryId) {
    try {
        closeModal();
        await apiDelete(`/menu/categories/${categoryId}`);

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
        const response = await apiGet('/menu/items?only_available=false&include_archived=true');
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

    const displayItems = [...menuItems].sort((a, b) => {
        if (a.isArchived === b.isArchived) return 0;
        return a.isArchived ? 1 : -1;
    });

    container.innerHTML = '';

    displayItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'p-3 bg-gray-50 rounded-lg mb-2';

        const statusLabel = item.isArchived
            ? '<span class="text-gray-500 text-xs">Archived</span>'
            : `<span class="${item.isAvailable ? 'text-green-600' : 'text-red-600'} text-xs">
                    ${item.isAvailable ? 'Available' : 'Not Available'}
                </span>`;

        const editButton = `
            <button
                onclick="showEditItemForm('${item.id}')"
                class="text-blue-600 hover:text-blue-700 text-sm"
            >
                Edit
            </button>
        `;

        const actionButton = item.isArchived
            ? `
                <div class="flex flex-col items-end gap-1">
                    ${editButton}
                    <button
                        onclick="unarchiveMenuItem('${item.id}')"
                        class="text-indigo-600 hover:text-indigo-700 text-sm"
                    >
                        Pulihkan
                    </button>
                </div>
            `
            : `
                <div class="flex flex-col items-end gap-1">
                    ${editButton}
                    <button
                        onclick="deleteMenuItem('${item.id}')"
                        class="text-red-500 hover:text-red-700 text-sm"
                    >
                        Arsipkan
                    </button>
                </div>
            `;

        itemDiv.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <p class="font-semibold text-gray-800">${item.name}</p>
                    <p class="text-xs text-gray-500">${item.category?.name || 'No category'}</p>
                </div>
                ${actionButton}
            </div>
            <div class="flex justify-between items-center text-sm">
                <span class="text-blue-600 font-semibold">${formatRupiah(item.price)}</span>
                <span class="text-gray-600">Stok: ${item.stock}</span>
                ${statusLabel}
            </div>
        `;

        container.appendChild(itemDiv);
    });
}

function getImageUploadConfig() {
    return {
        bucket: 'menu-images',
        maxWidth: 800,
        maxSizeKB: 300,
        quality: 0.82,
        mimeType: 'image/jpeg',
        extension: 'jpg',
        maxUploadBytes: 1024 * 1024
    };
}

function getSupabaseConfig() {
    const config = window.API_CONFIG || {};
    return {
        url: config.SUPABASE_URL || '',
        anonKey: config.SUPABASE_ANON_KEY || ''
    };
}

function getStoragePathFromPublicUrl(url, bucket) {
    try {
        const supabase = getSupabaseConfig();
        if (!supabase.url) return null;
        const baseUrl = `${supabase.url}/storage/v1/object/public/${bucket}/`;
        if (!url.startsWith(baseUrl)) return null;
        return url.slice(baseUrl.length);
    } catch (_err) {
        return null;
    }
}

async function deleteMenuImageByUrl(url) {
    if (!url) return;
    const config = getImageUploadConfig();
    const supabase = getSupabaseConfig();
    if (!supabase.url || !supabase.anonKey) return;

    const path = getStoragePathFromPublicUrl(url, config.bucket);
    if (!path) return;

    const deleteUrl = `${supabase.url}/storage/v1/object/${config.bucket}/${path}`;
    const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
            'apikey': supabase.anonKey,
            'Authorization': `Bearer ${supabase.anonKey}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.warn('Failed to delete image:', errorText);
    }
}

function generateImagePath(config) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `menu/${window.crypto.randomUUID()}.${config.extension}`;
    }
    const rand = Math.random().toString(36).slice(2, 10);
    return `menu/${Date.now()}-${rand}.${config.extension}`;
}

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = () => {
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = reader.result;
        };
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(file);
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
            }
            resolve(blob);
        }, type, quality);
    });
}

async function compressImageFile(file, config) {
    const image = await loadImageFromFile(file);
    let width = image.width;
    let height = image.height;
    if (width > config.maxWidth) {
        const ratio = config.maxWidth / width;
        width = config.maxWidth;
        height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);

    let quality = config.quality;
    let blob = await canvasToBlob(canvas, config.mimeType, quality);
    let attempts = 0;

    while (blob.size > config.maxSizeKB * 1024 && attempts < 6) {
        attempts += 1;
        if (quality > 0.5) {
            quality = Math.max(0.5, quality - 0.1);
        } else {
            width = Math.max(320, Math.round(width * 0.85));
            height = Math.max(240, Math.round(height * 0.85));
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(image, 0, 0, width, height);
            quality = 0.7;
        }
        blob = await canvasToBlob(canvas, config.mimeType, quality);
    }

    return blob;
}

async function uploadMenuImage(file) {
    if (!file) return null;
    if (!file.type.startsWith('image/')) {
        throw new Error('File harus berupa gambar');
    }

    const supabase = getSupabaseConfig();
    if (!supabase.url || !supabase.anonKey) {
        throw new Error('Supabase config belum diisi');
    }

    const config = getImageUploadConfig();
    const blob = await compressImageFile(file, config);
    if (blob.size > config.maxUploadBytes) {
        throw new Error('Ukuran gambar setelah kompres melebihi 1MB.');
    }
    const path = generateImagePath(config);
    const uploadUrl = `${supabase.url}/storage/v1/object/${config.bucket}/${path}`;

    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Content-Type': config.mimeType,
            'apikey': supabase.anonKey,
            'Authorization': `Bearer ${supabase.anonKey}`,
            'x-upsert': 'true'
        },
        body: blob
    });

    if (!response.ok) {
        const errorText = await response.text();
        let message = errorText;
        try {
            const data = JSON.parse(errorText);
            if (data?.message) message = data.message;
        } catch (_err) {
            // ignore parse error
        }
        throw new Error(message || 'Gagal upload gambar');
    }

    return `${supabase.url}/storage/v1/object/public/${config.bucket}/${path}`;
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
                <label class="block text-gray-700 font-semibold mb-1 text-sm">Gambar Menu (opsional)</label>
                <input
                    type="file"
                    id="item-image"
                    accept="image/*"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                <p class="text-xs text-gray-500 mt-1">Akan dikompres sebelum upload (maks 300KB).</p>
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

    const imageInput = document.getElementById('item-image');
    const imageFile = imageInput?.files?.[0] || null;

    try {
        let imageUrl;
        if (imageFile) {
            imageUrl = await uploadMenuImage(imageFile);
        }

        const data = {
            name: document.getElementById('item-name').value.trim(),
            categoryId: document.getElementById('item-category').value || undefined,
            price: parseInt(document.getElementById('item-price').value),
            stock: parseInt(document.getElementById('item-stock').value),
            isAvailable: document.getElementById('item-available').checked,
            imageUrl: imageUrl
        };

        await apiPost('/menu/items', data);

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
function deleteMenuItem(itemId) {
    openConfirmModal({
        title: 'Arsipkan Menu',
        message: 'Menu item akan diarsipkan dan disembunyikan dari menu.',
        confirmText: 'Arsipkan',
        onConfirm: () => confirmDeleteMenuItem(itemId)
    });
}

async function submitEditMenuItem(event, itemId) {
    event.preventDefault();

    const item = menuItems.find(menuItem => menuItem.id === itemId);
    if (!item) {
        showErrorAlert('Menu item tidak ditemukan');
        return;
    }

    const imageInput = document.getElementById('edit-item-image');
    const imageFile = imageInput?.files?.[0] || null;
    const removeImage = document.getElementById('edit-item-remove-image')?.checked;

    try {
        let newImageUrl;
        if (imageFile) {
            newImageUrl = await uploadMenuImage(imageFile);
        }

        const data = {
            name: document.getElementById('edit-item-name').value.trim(),
            categoryId: document.getElementById('edit-item-category').value || undefined,
            price: parseInt(document.getElementById('edit-item-price').value),
            stock: parseInt(document.getElementById('edit-item-stock').value),
            isAvailable: document.getElementById('edit-item-available').checked
        };

        if (newImageUrl) {
            data.imageUrl = newImageUrl;
        } else if (removeImage) {
            data.imageUrl = null;
        }

        await apiPatch(`/menu/items/${itemId}`, data);

        if (newImageUrl && item.imageUrl) {
            await deleteMenuImageByUrl(item.imageUrl);
        } else if (removeImage && item.imageUrl) {
            await deleteMenuImageByUrl(item.imageUrl);
        }

        showSuccess('Menu item berhasil diperbarui');
        closeModal();
        await loadMenuItems();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal memperbarui menu item');
    }
}

async function confirmDeleteMenuItem(itemId) {
    try {
        closeModal();
        await apiDelete(`/menu/items/${itemId}`);

        showSuccess('Menu item berhasil diarsipkan');
        await loadMenuItems();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal mengarsipkan menu item');
    }
}

function showEditItemForm(itemId) {
    const item = menuItems.find(menuItem => menuItem.id === itemId);
    if (!item) {
        showErrorAlert('Menu item tidak ditemukan');
        return;
    }

    document.getElementById('modal-title').textContent = 'Edit Menu Item';

    const categoryOptions = categories.map(cat =>
        `<option value="${cat.id}" ${item.categoryId === cat.id ? 'selected' : ''}>${cat.name}</option>`
    ).join('');

    const currentImageHtml = item.imageUrl
        ? `
            <div class="mt-2">
                <p class="text-xs text-gray-500 mb-1">Gambar saat ini:</p>
                <img src="${item.imageUrl}" alt="${item.name}" class="h-24 w-24 object-cover rounded border" />
            </div>
        `
        : '<p class="text-xs text-gray-400 mt-2">Belum ada gambar.</p>';

    document.getElementById('modal-body').innerHTML = `
        <form onsubmit="submitEditMenuItem(event, '${item.id}')" class="space-y-3">
            <div>
                <label class="block text-gray-700 font-semibold mb-1 text-sm">Nama Menu</label>
                <input
                    type="text"
                    id="edit-item-name"
                    value="${item.name}"
                    required
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
            </div>
            <div>
                <label class="block text-gray-700 font-semibold mb-1 text-sm">Kategori</label>
                <select id="edit-item-category" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Tanpa Kategori</option>
                    ${categoryOptions}
                </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-gray-700 font-semibold mb-1 text-sm">Harga</label>
                    <input
                        type="number"
                        id="edit-item-price"
                        value="${item.price}"
                        required
                        min="0"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                </div>
                <div>
                    <label class="block text-gray-700 font-semibold mb-1 text-sm">Stok</label>
                    <input
                        type="number"
                        id="edit-item-stock"
                        value="${item.stock}"
                        required
                        min="0"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                </div>
            </div>
            <div>
                <label class="block text-gray-700 font-semibold mb-1 text-sm">Gambar Menu (opsional)</label>
                <input
                    type="file"
                    id="edit-item-image"
                    accept="image/*"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                <label class="flex items-center mt-2 text-xs text-gray-600">
                    <input type="checkbox" id="edit-item-remove-image" class="mr-2">
                    Hapus gambar saat ini
                </label>
                ${currentImageHtml}
            </div>
            <div>
                <label class="flex items-center">
                    <input type="checkbox" id="edit-item-available" ${item.isAvailable ? 'checked' : ''} class="mr-2">
                    <span class="text-sm text-gray-700">Available untuk dijual</span>
                </label>
            </div>
            <button
                type="submit"
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-sm"
            >
                Simpan Perubahan
            </button>
        </form>
    `;

    document.getElementById('modal').classList.remove('hidden');
}

function unarchiveMenuItem(itemId) {
    openConfirmModal({
        title: 'Pulihkan Menu',
        message: 'Menu item akan dipulihkan dan muncul kembali di menu.',
        confirmText: 'Pulihkan',
        confirmClass: 'bg-indigo-600 hover:bg-indigo-700',
        onConfirm: () => confirmUnarchiveMenuItem(itemId)
    });
}

async function confirmUnarchiveMenuItem(itemId) {
    try {
        closeModal();
        await apiPatch(`/menu/items/${itemId}`, { isArchived: false, isAvailable: true });

        showSuccess('Menu item berhasil dipulihkan');
        await loadMenuItems();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal memulihkan menu item');
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

        const response = await apiGet('/tables');

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
        card.className = 'border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white';

        card.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div>
                    <p class="text-sm text-gray-500">ID ${table.id.substring(0, 8)}...</p>
                    <p class="text-2xl font-bold text-gray-800">Meja ${table.tableNumber}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${table.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${table.isActive ? 'Active' : 'Inactive'}
                </span>
            </div>

            <div class="bg-gray-50 rounded-lg p-3 mb-3 text-center">
                ${table.qrCode
                    ? `
                        <img src="${table.qrCode}" alt="QR Meja ${table.tableNumber}" class="mx-auto h-40 w-40 object-contain" />
                        <a href="${table.qrCode}" download="meja-${table.tableNumber}.png" class="text-indigo-600 font-semibold text-sm inline-block mt-2">
                            Download QR
                        </a>
                    `
                    : '<p class="text-xs text-gray-500">QR belum tersedia</p>'
                }
            </div>

            <div class="grid grid-cols-2 gap-2">
                <button
                    onclick="showEditTableForm('${table.id}')"
                    class="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 rounded-lg"
                >
                    Edit
                </button>
                <button
                    onclick="confirmDeleteTable('${table.id}', ${table.tableNumber})"
                    class="w-full bg-red-500 hover:bg-red-600 text-white text-sm py-2 rounded-lg"
                >
                    Hapus
                </button>
            </div>
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
                <label class="flex items-center">
                    <input type="checkbox" id="table-active" checked class="mr-2">
                    <span class="text-gray-700">Meja aktif</span>
                </label>
                <p class="text-xs text-gray-500 mt-1">QR akan digenerate otomatis setelah meja disimpan.</p>
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

    const tableNumber = parseInt(document.getElementById('table-number').value);

    if (isNaN(tableNumber) || tableNumber < 1) {
        showErrorAlert('Nomor meja tidak valid');
        return;
    }

    const data = {
        tableNumber,
        isActive: document.getElementById('table-active').checked
    };

    try {
        await apiPost('/tables', data);

        showSuccess('Meja berhasil ditambahkan. QR otomatis dibuat.');
        closeModal();
        await loadTables();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal menambahkan meja');
    }
}

/**
 * Function untuk show form edit table
 */
function showEditTableForm(tableId) {
    const table = tables.find(t => t.id === tableId);
    if (!table) {
        showErrorAlert('Data meja tidak ditemukan');
        return;
    }

    document.getElementById('modal-title').textContent = `Edit Meja ${table.tableNumber}`;

    document.getElementById('modal-body').innerHTML = `
        <form onsubmit="submitEditTable(event, '${table.id}')" class="space-y-4">
            <div>
                <label class="block text-gray-700 font-semibold mb-2">Nomor Meja</label>
                <input
                    type="number"
                    id="edit-table-number"
                    value="${table.tableNumber}"
                    required
                    min="1"
                    class="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
            </div>
            <div>
                <label class="flex items-center">
                    <input type="checkbox" id="edit-table-active" ${table.isActive ? 'checked' : ''} class="mr-2">
                    <span class="text-gray-700">Meja aktif</span>
                </label>
            </div>
            <div class="bg-gray-50 rounded-lg p-3">
                <label class="flex items-center mb-2">
                    <input type="checkbox" id="edit-regenerate-qr" class="mr-2">
                    <span class="text-gray-700 text-sm">Buat QR baru sekarang</span>
                </label>
                <p class="text-xs text-gray-500">QR akan digenerate ulang jika nomor meja diganti.</p>
                ${table.qrCode
                    ? `
                        <div class="text-center mt-3">
                            <p class="text-xs text-gray-500 mb-2">Preview QR</p>
                            <img src="${table.qrCode}" alt="QR Meja ${table.tableNumber}" class="mx-auto h-36 w-36 object-contain" />
                            <a href="${table.qrCode}" download="meja-${table.tableNumber}.png" class="text-indigo-600 font-semibold text-xs inline-block mt-2">
                                Download QR
                            </a>
                        </div>
                    `
                    : '<p class="text-xs text-gray-500">QR belum tersedia</p>'
                }
            </div>
            <button
                type="submit"
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg"
            >
                Simpan Perubahan
            </button>
        </form>
    `;

    document.getElementById('modal').classList.remove('hidden');
}

/**
 * Function untuk submit edit table form
 */
async function submitEditTable(event, tableId) {
    event.preventDefault();

    const tableNumber = parseInt(document.getElementById('edit-table-number').value);

    if (isNaN(tableNumber) || tableNumber < 1) {
        showErrorAlert('Nomor meja tidak valid');
        return;
    }

    const data = {
        tableNumber,
        isActive: document.getElementById('edit-table-active').checked,
        regenerateQr: document.getElementById('edit-regenerate-qr').checked
    };

    try {
        await apiPatch(`/tables/${tableId}`, data);

        showSuccess('Meja berhasil diperbarui');
        closeModal();
        await loadTables();

    } catch (error) {
        showErrorAlert(error.message || 'Gagal mengupdate meja');
    }
}

/**
 * Function untuk menampilkan modal konfirmasi delete meja (modern)
 */
function confirmDeleteTable(tableId, tableNumber) {
    openConfirmModal({
        title: 'Hapus Meja',
        message: `Hapus Meja ${tableNumber}? Tindakan tidak bisa dibatalkan.`,
        confirmText: 'Hapus',
        onConfirm: () => deleteTable(tableId)
    });
}

/**
 * Function untuk delete table
 */
async function deleteTable(tableId) {
    try {
        await apiDelete(`/tables/${tableId}`);

        closeModal();
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
 * Function untuk load report berdasarkan periode yang dipilih
 */
async function loadReport() {
    try {
        showLoading('report-content');

        const { endpoint } = buildReportRequest();

        const response = await apiGet(endpoint);

        if (endpoint.startsWith('/reports/daily')) {
            renderDailyReport(response.data);
        } else {
            renderSummaryReport(response.data);
        }

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

    const ordersHtml = renderReportOrders(data.orders || []);

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

        <!-- Orders Detail -->
        <div class="bg-gray-50 rounded-lg p-4 mt-6">
            <h4 class="font-bold text-gray-800 mb-3">Detail Orders</h4>
            ${ordersHtml}
        </div>
    `;
    setReportOrders(data.orders || []);
}

/**
 * Function untuk render summary report (range/month/year/all)
 */
function renderSummaryReport(data) {
    const container = document.getElementById('report-content');
    const ordersHtml = renderReportOrders(data.orders || []);

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
            ${Object.entries(data.revenueByMethod).map(([method, info]) => `
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-700">${method.toUpperCase()}</span>
                    <span class="font-semibold text-gray-900">${formatRupiah(info.revenue)} (${info.count} orders)</span>
                </div>
            `).join('') || '<p class="text-gray-500 text-sm">No data</p>'}
        </div>

        <!-- Revenue by Category -->
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 class="font-bold text-gray-800 mb-3">Revenue by Category</h4>
            ${Object.entries(data.revenueByCategory || {}).map(([category, info]) => `
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-700">${category}</span>
                    <span class="font-semibold text-gray-900">${formatRupiah(info.revenue)} (${info.itemsSold} items)</span>
                </div>
            `).join('') || '<p class="text-gray-500 text-sm">No data</p>'}
        </div>

        <!-- Inventory Snapshot -->
        <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-bold text-gray-800 mb-3">Inventory Snapshot</h4>
            <div class="grid md:grid-cols-3 gap-3">
                <div class="bg-white rounded-lg p-3 border">
                    <p class="text-xs text-gray-500 mb-1">Menu Items</p>
                    <p class="text-lg font-semibold text-gray-900">${data.inventory.totalMenuItems}</p>
                </div>
                <div class="bg-white rounded-lg p-3 border">
                    <p class="text-xs text-gray-500 mb-1">Categories</p>
                    <p class="text-lg font-semibold text-gray-900">${data.inventory.totalCategories}</p>
                </div>
                <div class="bg-white rounded-lg p-3 border">
                    <p class="text-xs text-gray-500 mb-1">Tables</p>
                    <p class="text-lg font-semibold text-gray-900">${data.inventory.totalTables}</p>
                </div>
            </div>
        </div>

        <!-- Orders Detail -->
        <div class="bg-gray-50 rounded-lg p-4 mt-6">
            <h4 class="font-bold text-gray-800 mb-3">Detail Orders</h4>
            ${ordersHtml}
        </div>
    `;
    setReportOrders(data.orders || []);
}

function renderReportOrders(orders) {
    const initialState = getReportFilterState(false);
    const initialOrders = sortAndFilterReportOrders(orders || [], initialState);
    const tableHtml = renderReportOrdersTable(initialOrders);

    return `
        <div class="grid md:grid-cols-4 gap-3 mb-2">
            <input
                type="number"
                id="report-table-filter"
                placeholder="Filter meja"
                class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                oninput="updateReportOrders()"
            >
            <select
                id="report-payment-filter"
                class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                onchange="updateReportOrders()"
            >
                <option value="">Semua Payment</option>
                <option value="cash">Cash</option>
                <option value="qris">QRIS</option>
            </select>
            <select
                id="report-sort-by"
                class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                onchange="updateReportOrders()"
            >
                <option value="paidAt" selected>Waktu Bayar</option>
                <option value="totalPrice">Total</option>
                <option value="tableNumber">Meja</option>
            </select>
            <select
                id="report-sort-dir"
                class="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                onchange="updateReportOrders()"
            >
                <option value="desc" selected>Terbaru</option>
                <option value="asc">Terlama</option>
            </select>
        </div>
        <p id="report-orders-count" class="text-xs text-gray-500 mb-2"></p>
        <div id="report-orders-table">
            ${tableHtml}
        </div>
    `;
}

function setReportOrders(orders) {
    reportOrdersCache = Array.isArray(orders) ? orders : [];
    updateReportOrders();
}

function updateReportOrders() {
    const container = document.getElementById('report-orders-table');
    if (!container) return;

    const state = getReportFilterState(true);
    const filtered = sortAndFilterReportOrders(reportOrdersCache, state);
    container.innerHTML = renderReportOrdersTable(filtered);

    const countLabel = document.getElementById('report-orders-count');
    if (countLabel) {
        countLabel.textContent = `Menampilkan ${filtered.length} dari ${reportOrdersCache.length}`;
    }
}

function getReportFilterState(useDom = true) {
    if (!useDom) {
        return {
            tableFilter: '',
            paymentFilter: '',
            sortBy: 'paidAt',
            sortDir: 'desc'
        };
    }

    return {
        tableFilter: document.getElementById('report-table-filter')?.value?.trim() || '',
        paymentFilter: document.getElementById('report-payment-filter')?.value || '',
        sortBy: document.getElementById('report-sort-by')?.value || 'paidAt',
        sortDir: document.getElementById('report-sort-dir')?.value || 'desc'
    };
}

function sortAndFilterReportOrders(orders, state) {
    let filtered = [...orders];

    if (state.tableFilter) {
        const tableValue = parseInt(state.tableFilter, 10);
        filtered = filtered.filter(order => {
            if (order.tableNumber === null || order.tableNumber === undefined) return false;
            return order.tableNumber === tableValue;
        });
    }

    if (state.paymentFilter) {
        filtered = filtered.filter(order => order.paymentMethod === state.paymentFilter);
    }

    const dir = state.sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
        let aValue;
        let bValue;

        if (state.sortBy === 'totalPrice') {
            aValue = a.totalPrice || 0;
            bValue = b.totalPrice || 0;
        } else if (state.sortBy === 'tableNumber') {
            aValue = a.tableNumber ?? 0;
            bValue = b.tableNumber ?? 0;
        } else {
            aValue = new Date(a.paidAt || a.createdAt).getTime();
            bValue = new Date(b.paidAt || b.createdAt).getTime();
        }

        if (aValue === bValue) return 0;
        return aValue > bValue ? dir : -dir;
    });

    return filtered;
}

function renderReportOrdersTable(orders) {
    if (!orders || orders.length === 0) {
        return '<p class="text-gray-500 text-sm">No data</p>';
    }

    const rows = orders.map(order => {
        const itemsText = (order.items || [])
            .map(item => `${item.quantity}x ${item.name} (${formatRupiah(item.price)})`)
            .join(', ');
        return `
            <tr class="border-b border-gray-200 last:border-0">
                <td class="py-2 pr-3 text-xs text-gray-600">${order.id.substring(0, 8)}...</td>
                <td class="py-2 pr-3 text-xs text-gray-700">${order.tableNumber ?? '-'}</td>
                <td class="py-2 pr-3 text-xs text-gray-700">${order.paymentMethod ?? '-'}</td>
                <td class="py-2 pr-3 text-xs text-gray-700">${formatRupiah(order.totalPrice)}</td>
                <td class="py-2 text-xs text-gray-700">${itemsText || '-'}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
                <thead>
                    <tr class="text-xs uppercase text-gray-500 border-b border-gray-300">
                        <th class="py-2 pr-3">Order ID</th>
                        <th class="py-2 pr-3">Meja</th>
                        <th class="py-2 pr-3">Payment</th>
                        <th class="py-2 pr-3">Total</th>
                        <th class="py-2">Items</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

// ========================================
// REPORT EXPORT FUNCTIONS
// ========================================

/**
 * Render input fields sesuai periode laporan
 */
function renderReportInputs() {
    const period = document.getElementById('report-period')?.value || 'day';
    const container = document.getElementById('report-inputs');
    if (!container) return;

    const today = new Date().toISOString().split('T')[0];
    const yearNow = new Date().getFullYear();

    if (period === 'day') {
        container.innerHTML = `
            <div class="col-span-2 md:col-span-1">
                <label class="block text-gray-700 text-sm mb-1">Tanggal</label>
                <input type="date" id="report-date" value="${today}" class="w-full border border-gray-300 rounded-lg px-3 py-2">
            </div>
        `;
        return;
    }

    if (period === 'month') {
        const monthDefault = today.slice(0, 7);
        container.innerHTML = `
            <div class="col-span-2 md:col-span-1">
                <label class="block text-gray-700 text-sm mb-1">Bulan</label>
                <input type="month" id="report-month" value="${monthDefault}" class="w-full border border-gray-300 rounded-lg px-3 py-2">
            </div>
        `;
        return;
    }

    if (period === 'year') {
        container.innerHTML = `
            <div class="col-span-2 md:col-span-1">
                <label class="block text-gray-700 text-sm mb-1">Tahun</label>
                <input type="number" id="report-year" value="${yearNow}" class="w-full border border-gray-300 rounded-lg px-3 py-2" min="2000" max="2100">
            </div>
        `;
        return;
    }

    if (period === 'range') {
        container.innerHTML = `
            <div class="col-span-2 md:col-span-1">
                <label class="block text-gray-700 text-sm mb-1">Start</label>
                <input type="date" id="report-start" value="${today}" class="w-full border border-gray-300 rounded-lg px-3 py-2">
            </div>
            <div class="col-span-2 md:col-span-1">
                <label class="block text-gray-700 text-sm mb-1">End</label>
                <input type="date" id="report-end" value="${today}" class="w-full border border-gray-300 rounded-lg px-3 py-2">
            </div>
        `;
        return;
    }

    // all
    container.innerHTML = `
        <div class="col-span-2 text-sm text-gray-600">All time. Tidak perlu pilih tanggal.</div>
    `;
}

function formatDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getReportOrdersLimit() {
    const limitValue = document.getElementById('report-orders-limit')?.value || '50';
    const limit = parseInt(limitValue, 10);
    return Number.isFinite(limit) && limit > 0 ? limit : 50;
}

function withOrdersLimit(endpoint) {
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}orders_limit=${getReportOrdersLimit()}`;
}

function buildReportRequest() {
    const period = document.getElementById('report-period')?.value || 'day';
    const today = new Date();

    if (period === 'day') {
        const date = document.getElementById('report-date')?.value;
        if (!date) throw new Error('Pilih tanggal terlebih dahulu');
        return { endpoint: withOrdersLimit(`/reports/daily?date=${date}`), period };
    }

    if (period === 'month') {
        const month = document.getElementById('report-month')?.value;
        if (!month) throw new Error('Pilih bulan terlebih dahulu');
        const [year, monthNum] = month.split('-').map(Number);
        const lastDay = new Date(year, monthNum, 0).getDate();
        const startDate = `${month}-01`;
        const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
        return { endpoint: withOrdersLimit(`/reports/summary?start_date=${startDate}&end_date=${endDate}`), period };
    }

    if (period === 'year') {
        const year = document.getElementById('report-year')?.value;
        if (!year) throw new Error('Isi tahun terlebih dahulu');
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        return { endpoint: withOrdersLimit(`/reports/summary?start_date=${startDate}&end_date=${endDate}`), period };
    }

    if (period === 'range') {
        const start = document.getElementById('report-start')?.value;
        const end = document.getElementById('report-end')?.value;
        if (!start || !end) throw new Error('Lengkapi start dan end date');
        return { endpoint: withOrdersLimit(`/reports/summary?start_date=${start}&end_date=${end}`), period };
    }

    const startDate = '1970-01-01';
    const endDate = formatDateValue(today);
    return { endpoint: withOrdersLimit(`/reports/summary?start_date=${startDate}&end_date=${endDate}`), period: 'all' };
}

/**
 * Trigger export file untuk penjualan
 */
async function exportSales() {
    const period = document.getElementById('report-period')?.value || 'day';
    const format = document.getElementById('report-format')?.value || 'csv';
    const params = new URLSearchParams({ period, format });

    if (period === 'day') {
        const date = document.getElementById('report-date')?.value;
        if (!date) return showErrorAlert('Pilih tanggal untuk export perhari.');
        params.set('date', date);
    } else if (period === 'month') {
        const month = document.getElementById('report-month')?.value;
        if (!month) return showErrorAlert('Pilih bulan untuk export perbulan.');
        params.set('month', month);
    } else if (period === 'year') {
        const year = document.getElementById('report-year')?.value;
        if (!year) return showErrorAlert('Isi tahun untuk export pertahun.');
        params.set('year', year);
    } else if (period === 'range') {
        const start = document.getElementById('report-start')?.value;
        const end = document.getElementById('report-end')?.value;
        if (!start || !end) return showErrorAlert('Lengkapi start dan end date untuk export range.');
        params.set('start', start);
        params.set('end', end);
    }

    try {
        const url = `${API_CONFIG.BASE_URL}/reports/export?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            let message = 'Gagal export laporan';
            try {
                const data = await response.json();
                message = data.message || message;
            } catch (_err) {
                // ignore parse error
            }
            throw new Error(message);
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `sales-${period}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);

        showSuccess('Berhasil download laporan.');
    } catch (error) {
        showErrorAlert(error.message || 'Gagal export laporan');
    }
}

// ========================================
// MODAL FUNCTIONS
// ========================================

/**
 * Generic confirmation modal
 * @param {{title: string, message: string, confirmText?: string, confirmClass?: string, onConfirm: Function}} params
 */
function openConfirmModal({ title, message, confirmText = 'Lanjut', confirmClass = 'bg-red-600 hover:bg-red-700', onConfirm }) {
    confirmActionCallback = onConfirm;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = `
        <div class="text-center space-y-4">
            <div class="w-14 h-14 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </div>
            <p class="text-lg font-semibold text-gray-800">${message}</p>
            <div class="grid grid-cols-2 gap-3 pt-2">
                <button
                    type="button"
                    onclick="closeModal()"
                    class="w-full border border-gray-300 text-gray-700 font-semibold py-2 rounded-lg hover:bg-gray-50"
                >
                    Batal
                </button>
                <button
                    type="button"
                    onclick="runConfirmAction()"
                    class="w-full ${confirmClass} text-white font-semibold py-2 rounded-lg"
                >
                    ${confirmText}
                </button>
            </div>
        </div>
    `;

    document.getElementById('modal').classList.remove('hidden');
}

function runConfirmAction() {
    const cb = confirmActionCallback;
    confirmActionCallback = null;
    closeModal();
    if (typeof cb === 'function') {
        cb();
    }
}

/**
 * Function untuk close modal
 */
function closeModal(event) {
    // Jika click pada backdrop (bukan di dalam modal body), close modal
    if (!event || event.target.id === 'modal') {
        document.getElementById('modal').classList.add('hidden');
    }
    confirmActionCallback = null;
}





