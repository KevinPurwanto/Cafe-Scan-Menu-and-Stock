# 📱 CARA MENGGUNAKAN APLIKASI

## 🚀 Quick Start (3 Langkah)

### 1️⃣ Jalankan Backend
```bash
cd c:\Code\Project_skripsi_vicky\Cafe-Scan-Menu-and-Stock
npm run dev
```

### 2️⃣ Setup Database (Jika Pertama Kali)
```bash
npm run prisma:push
```

### 3️⃣ Buka Frontend
**Double click:** `frontend/index.html`

---

## 🎯 DEMO FLOW - Test Aplikasi

### 🛒 **CUSTOMER FLOW (Test Order)**

#### **A. Persiapan: Buat Data Dummy**

Sebelum test customer, kita perlu data dummy dulu. Buka **Admin Dashboard**:

1. **Buka:** `frontend/admin.html`
2. **Login:**
   - API Key: `Pempek-Yenny`
   - Click "Login"

3. **Tab Tables - Buat Meja:**
   - Click "Tambah Meja"
   - Isi Nomor Meja: `1`
   - Centang "Meja aktif"
   - Click "Tambah" → QR langsung digenerate
   - Di card meja, klik **Download QR** untuk print/simpan

   Ulangi untuk meja 2, 3, dst.

4. **Tab Menu - Buat Kategori:**
   - Click "Tambah" di section Kategori
   - Nama: `Minuman`
   - Click "Tambah"

   Buat kategori lain: `Makanan`, `Dessert`

5. **Tab Menu - Buat Menu Items:**
   - Click "Tambah" di section Menu Items
   - Isi form:
     - Nama: `Kopi Susu`
     - Kategori: `Minuman`
     - Harga: `15000`
     - Stok: `100`
     - Centang "Available untuk dijual"
   - Click "Tambah"

   Buat beberapa menu lagi:
   - Nama: `Es Teh`, Kategori: `Minuman`, Harga: `8000`, Stok: `100`
   - Nama: `Nasi Goreng`, Kategori: `Makanan`, Harga: `25000`, Stok: `50`
   - Nama: `Mie Goreng`, Kategori: `Makanan`, Harga: `20000`, Stok: `50`

**✅ Data dummy siap!**

---

#### **B. Test Order sebagai Customer:**

1. **Buka:** `frontend/index.html`
2. **Click:** Button "Mulai Pesan" (Card Customer)
3. **Input Table Number Manual:**
   - Scroll ke bawah ke "Masukkan Nomor Meja Secara Manual"
   - Ketik: `1`
   - Click "OK"

   ✅ Meja berhasil dipilih! Akan muncul "Anda di: Meja 1"

4. **Browse Menu:**
   - Akan muncul kategori: Semua, Minuman, Makanan, Dessert
   - Click kategori untuk filter
   - Lihat menu items dengan harga dan stok

5. **Add to Cart:**
   - Pilih item, contoh: `Kopi Susu`
   - Set quantity: Click tombol `+` untuk tambah (atau biarkan 1)
   - Click "Keranjang"

   ✅ Item masuk cart! Badge di navbar akan update (contoh: 1)

6. **Tambah Item Lain:**
   - Add `Es Teh` (quantity: 2)
   - Add `Nasi Goreng` (quantity: 1)

   ✅ Total cart: 4 items

7. **Lihat Cart:**
   - Click icon **Cart** (🛒) di navbar kanan atas
   - Cart sidebar slide dari kanan
   - Lihat semua items dengan quantity dan total harga

   **Di cart bisa:**
   - Update quantity (+ / -)
   - Remove item (X)

8. **Checkout:**
   - Click button "Checkout" di bawah cart
   - Modal checkout terbuka
   - Lihat summary: Total items & Total harga

9. **Pilih Payment Method:**
   - Pilih "💵 Cash" atau "📱 QRIS"
   - Click "Konfirmasi"

   ✅ Loading...

10. **Success!**
    - Success modal muncul dengan ✅
    - Tampil Order ID
    - Payment instructions sesuai method yang dipilih
    - Click "OK"

**✅ ORDER BERHASIL!** Cart akan kosong, siap order lagi.

---

### 👨‍💼 **ADMIN FLOW (Kelola Pesanan & Laporan)**

#### **A. Login Admin:**

1. **Buka:** `frontend/admin.html`
2. **Input API Key:** `Pempek-Yenny`
3. **Click:** "Login"

✅ Dashboard terbuka!

---

#### **B. Tab Orders - Monitor Pesanan:**

1. **Otomatis menampilkan** semua orders
2. **Filter by status:**
   - Dropdown: Pilih "Pending", "Paid", atau "Cancelled"
   - Otomatis reload

3. **Lihat Detail Order:**
   - Order ID (8 karakter pertama)
   - Status badge (warna: yellow=pending, green=paid, red=cancelled)
   - Meja
   - Jumlah items
   - Total harga
   - Payment method
   - Tanggal & waktu

**✅ Semua orders dari customer akan muncul di sini!**

---

#### **C. Tab Menu - Kelola Menu:**

**Manage Categories:**

1. **Add Category:**
   - Click "Tambah" di section Kategori
   - Input nama: `Snack`
   - Click "Tambah"

2. **Delete Category:**
   - Click "Hapus" di category yang ingin dihapus
   - Confirm
   - ⚠️ Tidak bisa delete jika masih ada items di category tersebut

**Manage Menu Items:**

1. **Add Item:**
   - Click "Tambah" di section Menu Items
   - Isi form lengkap
   - Click "Tambah"

2. **Delete Item:**
   - Click "Hapus" di item yang ingin dihapus
   - Confirm
   - ⚠️ Tidak bisa delete jika ada pending orders

**✅ Menu bisa dikelola real-time!**

---

#### **D. Tab Tables - Kelola Meja:**

1. **Lihat Semua Meja:**
   - Grid view dengan card meja
   - Lihat: Nomor meja, QR code, Status (Active/Inactive)

2. **Add Meja Baru:**
   - Click "Tambah Meja"
   - Isi form: Nomor Meja `10`, centang "Meja aktif"
   - Click "Tambah" ? QR otomatis dibuat & bisa di-download di card

3. **Edit Meja:**
   - Click "Edit" di card meja
   - Ubah nomor atau status aktif
   - Opsional: centang "Buat QR baru" untuk regenerasi manual (otomatis jika nomor diubah)

4. **Delete Meja:**
   - Click "Hapus Meja" di card meja
   - Confirm
   - ?? Hati-hati, akan kehilangan history orders di meja tersebut

**? Meja bisa dikelola!**

---

#### **E. Tab Reports - Lihat Laporan:**

1. **Pilih Tanggal:**
   - Input date picker akan default ke hari ini
   - Atau pilih tanggal lain

2. **Click:** "Lihat Laporan"

3. **Lihat Summary:**
   - **Total Orders** (jumlah)
   - **Total Revenue** (Rupiah)
   - **Average Order Value** (Rupiah per order)

4. **Revenue by Payment Method:**
   - Cash: Rp xxx
   - QRIS: Rp xxx

5. **Top Selling Items:**
   - Ranking 1-10
   - Nama item, category
   - Quantity sold
   - Revenue

**✅ Laporan penjualan lengkap!**

---

## 🧪 TESTING CHECKLIST

### ✅ Customer Features:

- [ ] Bisa input table number
- [ ] Menu items tampil
- [ ] Filter by category works
- [ ] Add to cart works
- [ ] Cart badge update
- [ ] Cart sidebar open/close
- [ ] Update quantity di cart
- [ ] Remove item dari cart
- [ ] Total price calculation correct
- [ ] Checkout modal works
- [ ] Select payment method
- [ ] Confirm order success
- [ ] Order ID ditampilkan
- [ ] Cart clear setelah order

### ✅ Admin Features:

- [ ] Login dengan API key works
- [ ] Orders list tampil
- [ ] Filter orders by status
- [ ] Add category works
- [ ] Delete category works
- [ ] Add menu item works
- [ ] Delete menu item works
- [ ] Add table works
- [ ] Delete table works
- [ ] Daily report works
- [ ] Report statistics correct
- [ ] Top items ranking correct

---

## 🎯 SKENARIO TESTING LENGKAP

### **Skenario 1: Order dari 2 Meja Berbeda**

1. **Meja 1:**
   - Buka `customer.html` di browser/tab 1
   - Input meja: `1`
   - Order: 2x Kopi Susu, 1x Nasi Goreng
   - Payment: Cash
   - Konfirmasi

2. **Meja 2:**
   - Buka `customer.html` di browser/tab 2 (atau incognito)
   - Input meja: `2`
   - Order: 3x Es Teh, 1x Mie Goreng
   - Payment: QRIS
   - Konfirmasi

3. **Check di Admin:**
   - Buka `admin.html`
   - Tab Orders
   - Akan muncul 2 orders dengan status "paid"
   - Check detail: meja berbeda, items berbeda

**✅ Multi-table ordering works!**

---

### **Skenario 2: Stok Habis**

1. **Admin:** Update stok item jadi 5
   - Tab Menu
   - Misalnya "Kopi Susu" stok: 5

2. **Customer:** Coba order 10x Kopi Susu
   - Increase quantity jadi 10
   - Add to cart
   - Checkout
   - **Expected:** Error "Insufficient stock"

**✅ Stock validation works!**

---

### **Skenario 3: Cancel Order**

Fitur cancel order ada di code, tapi belum ada UI button.

**Manual test via API:**
```javascript
// Di browser console
const orderId = 'paste-order-id-here';
await apiPost(`/orders/${orderId}/cancel`);
```

---

## 📱 TEST QR SCANNER (Real Camera)

### **Cara 1: Ambil QR Code dari Admin**

1. Buka Admin Dashboard > Tab Tables.
2. Pastikan meja sudah dibuat, lalu klik **Download QR** pada card meja (contoh: Meja 1).
3. Print atau tampilkan QR tersebut di screen lain.

### **Cara 2: Scan dengan HP**

1. Buka `customer.html` di HP browser
   - Cara: Share link via WhatsApp/email, buka di HP
   - Atau: Upload ke GitHub Pages / Netlify (gratis)

2. Allow camera permission

3. Click "Start Scanner"

4. Arahkan camera ke QR code

5. **Auto-detect!** ✅

---

## 🐛 TROUBLESHOOTING

### ❌ "Backend not connected"

**Problem:** Console error, API tidak connect

**Fix:**
1. Check backend running: `npm run dev`
2. Test manual: Buka `http://localhost:3000/health` di browser
3. Should return: `{"success": true, "message": "ok"}`

---

### ❌ "Table not found"

**Problem:** Input table number tapi error 404

**Fix:**
1. Pastikan table sudah dibuat via Admin
2. Check table number benar
3. Check table status = Active

---

### ❌ "Menu tidak muncul"

**Problem:** Customer page kosong, tidak ada menu

**Fix:**
1. Buka Admin → Tab Menu
2. Pastikan ada Categories
3. Pastikan ada Menu Items dengan `isAvailable = true`
4. Refresh customer page

---

### ❌ "Order failed"

**Problem:** Checkout error

**Possible causes & fix:**
1. **Stok habis:** Check stok di Admin → Menu
2. **Table tidak valid:** Check table masih active
3. **Backend error:** Check terminal log backend
4. **API key salah (admin):** Re-login dengan key yang benar

---

### ❌ "QR Scanner tidak muncul"

**Problem:** Camera tidak terbuka

**Fix:**
1. Allow camera permission di browser
2. Gunakan Chrome/Edge (Firefox bisa tapi kadang issue)
3. HTTPS required (atau localhost)
4. Fallback: Gunakan input manual table number

---

## 🎓 TIPS DEVELOPMENT

### **1. Test di Browser Console**

```javascript
// Check config
console.log(API_CONFIG);

// Test API manually
await apiGet('/health');
await apiGet('/menu/items');

// Check cart
console.log(cart);

// Check localStorage
console.log(localStorage.getItem('cart'));
```

### **2. Clear Cache**

Jika perubahan code tidak muncul:
- Hard refresh: `Ctrl + Shift + R` (Windows)
- Clear browser cache
- Atau buka Incognito mode

### **3. Monitor Network**

1. Buka DevTools (F12)
2. Tab **Network**
3. Lihat semua API requests
4. Check status code (200 = OK, 400 = Error, 500 = Server error)

### **4. Debug JavaScript**

Tambah `console.log()` di code:

```javascript
function addToCart(item) {
    console.log('Adding:', item);
    console.log('Current cart:', cart);
    // ... code
}
```

---

## 🎉 SELAMAT TESTING!

Aplikasi Anda sudah **100% functional** dengan:
- ✅ Real-time order system
- ✅ Stock management
- ✅ Multi-table support
- ✅ Payment methods
- ✅ Admin dashboard
- ✅ Sales reports

**Semua dengan comment lengkap untuk belajar!** 📚

Good luck dengan skripsi Anda! 🚀
