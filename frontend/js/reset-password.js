window.onload = function() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || '';
    const tokenInput = document.getElementById('reset-token');
    tokenInput.value = token;

    if (!token) {
        showErrorAlert('Token reset tidak ditemukan.');
    }
};

async function resetPassword(event) {
    event.preventDefault();

    const token = document.getElementById('reset-token').value.trim();
    const password = document.getElementById('reset-password').value;
    const confirm = document.getElementById('reset-password-confirm').value;

    if (!token) {
        showErrorAlert('Token reset tidak valid.');
        return;
    }

    if (password.length < 8) {
        showErrorAlert('Password minimal 8 karakter.');
        return;
    }

    if (password !== confirm) {
        showErrorAlert('Konfirmasi password tidak sama.');
        return;
    }

    try {
        await apiPost('/auth/admin/reset-password', { token, password });
        showSuccess('Password berhasil direset. Silakan login kembali.');
        setTimeout(() => {
            window.location.href = '/admin';
        }, 1500);
    } catch (error) {
        showErrorAlert(error.message || 'Gagal reset password.');
    }
}
