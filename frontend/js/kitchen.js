// ============================================
// KITCHEN.JS - Logic untuk halaman dapur
// ============================================

let kitchenApiKey = null;
let orders = [];
let pollTimer = null;
let pollIntervalMs = 10000;
let lastOrderIds = new Set();
let isFirstLoad = true;
let audioContext = null;

window.onload = function() {
    const savedKey = sessionStorage.getItem('kitchenApiKey') || sessionStorage.getItem('adminApiKey');
    if (savedKey) {
        kitchenApiKey = savedKey;
        showDashboard();
    }
};

async function login(event) {
    event.preventDefault();
    initAudio();

    const apiKeyInput = document.getElementById('api-key-input');
    const enteredApiKey = apiKeyInput.value.trim();

    if (!enteredApiKey) {
        showErrorAlert('API Key tidak boleh kosong');
        return;
    }

    try {
        await apiGet('/orders', {
            'x-api-key': enteredApiKey
        });

        kitchenApiKey = enteredApiKey;
        sessionStorage.setItem('kitchenApiKey', enteredApiKey);

        showDashboard();
        showSuccess('Login berhasil!');
    } catch (error) {
        console.error('Login error:', error);
        showErrorAlert('API Key salah atau backend tidak tersedia');
    }
}

function logout() {
    kitchenApiKey = null;
    sessionStorage.removeItem('kitchenApiKey');
    sessionStorage.removeItem('adminApiKey');
    stopPolling();

    document.getElementById('kitchen-dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('kitchen-dashboard').classList.remove('hidden');

    const pollSelect = document.getElementById('poll-interval');
    if (pollSelect) {
        pollSelect.value = String(pollIntervalMs / 1000);
    }
    updatePollLabel();

    initAudio();
    startPolling();
}

function startPolling() {
    stopPolling();
    loadOrders();
    pollTimer = setInterval(loadOrders, pollIntervalMs);
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function updatePollInterval() {
    const pollSelect = document.getElementById('poll-interval');
    const seconds = parseInt(pollSelect?.value || '10', 10);
    pollIntervalMs = Math.max(5, seconds) * 1000;
    updatePollLabel();
    startPolling();
}

function updatePollLabel() {
    const label = document.getElementById('poll-label');
    if (label) {
        label.textContent = String(Math.round(pollIntervalMs / 1000));
    }
}

async function loadOrders() {
    if (!kitchenApiKey) return;

    try {
        showLoading('kitchen-orders');

        const statusFilter = document.getElementById('order-status-filter')?.value || '';
        const queryString = statusFilter ? `?status=${statusFilter}` : '';

        const response = await apiGet(`/orders${queryString}`, {
            'x-api-key': kitchenApiKey
        });

        const list = response.data || [];
        const detailPromises = list.map(order =>
            apiGet(`/orders/${order.id}`)
                .then(detail => detail.data)
                .catch(() => null)
        );
        const detailed = await Promise.all(detailPromises);
        const showServed = document.getElementById('show-served')?.checked;
        const filtered = detailed.map((item, index) => item || list[index]).filter(Boolean)
            .filter(order => (showServed || statusFilter === 'served') ? true : order.status !== 'served');

        orders = filtered;

        const currentIds = new Set(orders.map(order => order.id));
        const newOrderIds = [];
        if (!isFirstLoad) {
            orders.forEach(order => {
                if (!lastOrderIds.has(order.id)) {
                    newOrderIds.push(order.id);
                }
            });
        }
        lastOrderIds = currentIds;
        isFirstLoad = false;

        renderOrders(newOrderIds);

        if (newOrderIds.length > 0) {
            showKitchenToast(`Pesanan baru masuk: ${newOrderIds.length}`);
            playNotificationSound();
        }

        updateLastUpdated();
    } catch (error) {
        console.error('Error loading orders:', error);
        showError('kitchen-orders', error.message || 'Gagal memuat pesanan');
    }
}

function renderOrders(highlightIds = []) {
    const container = document.getElementById('kitchen-orders');

    if (!orders.length) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Tidak ada pesanan</p>';
        return;
    }

    container.innerHTML = '';
    const highlightSet = new Set(highlightIds);

    orders.forEach(order => {
        const card = document.createElement('div');
        const highlightClass = highlightSet.has(order.id)
            ? 'ring-2 ring-orange-400 animate-pulse'
            : '';
        card.className = `bg-white rounded-lg shadow-md p-5 mb-4 border border-gray-100 ${highlightClass}`;

        const statusClass = getStatusClass(order.status);
        const statusLabel = getStatusLabel(order.status);
        const itemsHtml = (order.items || []).map(item => `
            <div class="flex justify-between text-sm py-1">
                <span class="text-gray-700">${item.menuItem?.name || item.menuName || 'Item'}</span>
                <span class="font-semibold text-gray-800">x${item.quantity}</span>
            </div>
        `).join('') || '<p class="text-sm text-gray-500">Tidak ada item</p>';

        let actionHtml = '';
        if (order.status === 'served') {
            actionHtml = `
                <button
                    onclick="unserveOrder('${order.id}')"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold px-3 py-1 rounded-lg"
                >
                    Batalkan Sajikan
                </button>
            `;
        } else if (order.status === 'validated' || order.status === 'paid') {
            actionHtml = `
                <button
                    onclick="serveOrder('${order.id}')"
                    class="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-3 py-1 rounded-lg"
                >
                    Sajikan
                </button>
            `;
        }

        card.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                    <p class="text-xs text-gray-500">Order ID</p>
                    <p class="font-mono text-sm font-semibold text-gray-800">${order.id.substring(0, 8)}...</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Meja</p>
                    <p class="text-lg font-bold text-orange-600">${order.table?.tableNumber || '-'}</p>
                </div>
                <div>
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusClass}">
                        ${order.status.toUpperCase()}
                    </span>
                    <p class="text-xs text-gray-500 mt-1">${statusLabel}</p>
                </div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3 mb-3">
                ${itemsHtml}
            </div>
            ${actionHtml ? `<div class="flex justify-end mb-3">${actionHtml}</div>` : ''}
            <div class="flex flex-wrap items-center justify-between text-xs text-gray-500">
                <span>${formatDate(order.createdAt)}</span>
                <span>Payment: ${order.paymentMethod || '-'}</span>
                <span>Total: ${formatRupiah(order.totalPrice || 0)}</span>
            </div>
        `;

        container.appendChild(card);
    });
}

function updateLastUpdated() {
    const label = document.getElementById('last-updated');
    if (label) {
        label.textContent = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

function getStatusClass(status) {
    if (status === 'validated') return 'bg-blue-100 text-blue-800';
    if (status === 'paid') return 'bg-green-100 text-green-800';
    if (status === 'served') return 'bg-teal-100 text-teal-800';
    if (status === 'cancelled') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
}

function getStatusLabel(status) {
    if (status === 'validated') return 'Siap diproses';
    if (status === 'paid') return 'Sudah dibayar';
    if (status === 'served') return 'Disajikan';
    if (status === 'cancelled') return 'Dibatalkan';
    return 'Belum divalidasi';
}

async function serveOrder(orderId) {
    if (!confirm('Tandai pesanan ini sudah disajikan?')) {
        return;
    }

    try {
        await apiPost(`/orders/${orderId}/serve`, {}, {
            'x-api-key': kitchenApiKey
        });
        showSuccess('Pesanan ditandai disajikan.');
        await loadOrders();
    } catch (error) {
        showErrorAlert(error.message || 'Gagal menandai pesanan');
    }
}

async function unserveOrder(orderId) {
    try {
        await apiPost(`/orders/${orderId}/unserve`, {}, {
            'x-api-key': kitchenApiKey
        });
        showSuccess('Status sajikan dibatalkan.');
        await loadOrders();
    } catch (error) {
        showErrorAlert(error.message || 'Gagal membatalkan status sajikan');
    }
}

function initAudio() {
    if (audioContext) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            audioContext = new AudioCtx();
        }
    } catch (_err) {
        audioContext = null;
    }
}

function playNotificationSound() {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(audioContext.destination);

    const now = audioContext.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.stop(now + 0.3);
}

function showKitchenToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}
