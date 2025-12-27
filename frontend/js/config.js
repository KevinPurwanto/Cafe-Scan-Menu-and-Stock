// ============================================
// CONFIG.JS - Konfigurasi API Backend
// ============================================
// File ini berisi URL API backend yang akan digunakan
// oleh frontend untuk berkomunikasi dengan server

// URL dasar API backend
// Default: gunakan origin yang sama (cocok untuk ngrok/HTTPS dan serve dari backend)
const API_BASE_URL = window.location.origin === 'null'
    ? 'http://localhost:3000'
    : window.location.origin;

// Supabase storage config
const SUPABASE_URL = 'https://imlsynklqghvxezxfcyk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kDbgOxWNjGXJzDT03J4u3w_FDIdZMPk';

// Jika deploy ke production, ganti dengan URL production:
// const API_BASE_URL = 'https://api-anda.com';

// Export agar bisa digunakan di file lain
// Dengan export, variabel ini bisa di-import di file JS lain
window.API_CONFIG = {
    BASE_URL: API_BASE_URL,
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY
};

// ============================================
// HELPER FUNCTIONS - Fungsi Pembantu
// ============================================

/**
 * Fungsi untuk melakukan HTTP request ke API
 * @param {string} endpoint - Endpoint API (contoh: '/menu/items')
 * @param {object} options - Options untuk fetch (method, body, headers, dll)
 * @returns {Promise} - Promise yang resolve dengan response data
 */
async function apiRequest(endpoint, options = {}) {
    try {
        // Gabungkan BASE_URL dengan endpoint
        const url = `${API_BASE_URL}${endpoint}`;

        // Set default headers
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers // Merge dengan headers yang dikirim
        };

        // Lakukan fetch ke API
        const response = await fetch(url, {
            ...options,
            headers
        });

        // Parse response body sebagai JSON
        const data = await response.json();

        // Jika response tidak OK (status 4xx atau 5xx), throw error
        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong');
        }

        // Return data jika sukses
        return data;
    } catch (error) {
        // Tangkap dan throw error untuk ditangani di caller
        console.error('API Error:', error);
        throw error;
    }
}

/**
 * Fungsi untuk melakukan GET request
 * @param {string} endpoint - Endpoint API
 * @param {object} headers - Custom headers (optional)
 */
async function apiGet(endpoint, headers = {}) {
    return apiRequest(endpoint, {
        method: 'GET',
        headers
    });
}

/**
 * Fungsi untuk melakukan POST request
 * @param {string} endpoint - Endpoint API
 * @param {object} body - Data yang akan dikirim
 * @param {object} headers - Custom headers (optional)
 */
async function apiPost(endpoint, body, headers = {}) {
    return apiRequest(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body) // Convert object ke JSON string
    });
}

/**
 * Fungsi untuk melakukan PATCH request (update)
 * @param {string} endpoint - Endpoint API
 * @param {object} body - Data yang akan diupdate
 * @param {object} headers - Custom headers (optional)
 */
async function apiPatch(endpoint, body, headers = {}) {
    return apiRequest(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
    });
}

/**
 * Fungsi untuk melakukan DELETE request
 * @param {string} endpoint - Endpoint API
 * @param {object} headers - Custom headers (optional)
 */
async function apiDelete(endpoint, headers = {}) {
    return apiRequest(endpoint, {
        method: 'DELETE',
        headers
    });
}

/**
 * Fungsi untuk format rupiah
 * @param {number} amount - Jumlah uang
 * @returns {string} - String format rupiah (contoh: "Rp 15.000")
 */
function formatRupiah(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
}

/**
 * Fungsi untuk format tanggal
 * @param {string} dateString - String tanggal ISO
 * @returns {string} - String tanggal yang readable
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Fungsi untuk show loading spinner
 * @param {string} elementId - ID element yang akan diberi loading
 */
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="flex justify-center items-center p-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        `;
    }
}

/**
 * Fungsi untuk show error message
 * @param {string} elementId - ID element yang akan diberi error message
 * @param {string} message - Pesan error
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p class="font-bold">Error!</p>
                <p>${message}</p>
            </div>
        `;
    }
}

/**
 * Fungsi untuk show success message (toast)
 * @param {string} message - Pesan sukses
 */
function showSuccess(message) {
    // Buat element toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.textContent = message;

    // Tambahkan ke body
    document.body.appendChild(toast);

    // Hapus setelah 3 detik
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Fungsi untuk show alert error
 * @param {string} message - Pesan error
 */
function showErrorAlert(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Export semua fungsi helper ke window agar bisa digunakan di file lain
window.apiGet = apiGet;
window.apiPost = apiPost;
window.apiPatch = apiPatch;
window.apiDelete = apiDelete;
window.formatRupiah = formatRupiah;
window.formatDate = formatDate;
window.showLoading = showLoading;
window.showError = showError;
window.showSuccess = showSuccess;
window.showErrorAlert = showErrorAlert;
