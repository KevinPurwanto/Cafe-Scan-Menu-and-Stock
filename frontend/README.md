# Frontend - Cafe Scan Menu and Stock

Frontend web application untuk sistem pemesanan kafe dengan QR code scanner.

## 📁 Struktur Folder

```
frontend/
├── index.html           # Landing page (pilih Customer/Admin)
├── customer.html        # Halaman customer dengan QR scanner
├── admin.html          # Dashboard admin
├── css/
│   └── style.css       # Custom CSS styling
└── js/
    ├── config.js       # Konfigurasi API & helper functions
    ├── customer.js     # Logic untuk customer page
    └── admin.js        # Logic untuk admin page
```

## 🚀 Cara Menjalankan

### 1. Pastikan Backend Sudah Running

Frontend ini membutuhkan backend API. Pastikan backend sudah running di `http://localhost:3000`

```bash
# Di folder root project
cd ../
npm run dev
```

### 2. Buka Frontend di Browser

Ada 2 cara:

#### Option A: Langsung buka file HTML (Paling Mudah)
- Klik kanan `index.html` → Open with → Browser (Chrome/Firefox/Edge)
- Atau double click file `index.html`

#### Option B: Gunakan Live Server (Recommended untuk Development)
- Install extension "Live Server" di VS Code
- Klik kanan `index.html` → Open with Live Server
- Akan otomatis reload ketika ada perubahan code

### 3. Test Koneksi

Buka browser console (F12) dan check apakah ada pesan:
```
✅ Backend connected: {success: true, message: "ok"}
```

Jika ada error:
```
⚠️ Backend not connected. Make sure backend is running...
```
Berarti backend belum running atau ada masalah.

## 🎯 Fitur-Fitur

### Landing Page ([index.html](index.html))
- Pilih role: Customer atau Admin
- Auto-check koneksi ke backend
- Responsive design (mobile & desktop)

### Customer Page ([customer.html](customer.html))

#### 1. QR Scanner
- **Real QR code scanner** menggunakan camera HP/laptop
- Support front & back camera
- Fallback: Input manual table number

#### 2. Menu Browsing
- Filter menu by category
- Display harga, stok, availability
- Add to cart dengan quantity selector

#### 3. Shopping Cart
- Sidebar cart (slide dari kanan)
- Update quantity, remove items
- Real-time total calculation
- Persistent di localStorage

#### 4. Checkout & Payment
- Pilih payment method (Cash/QRIS)
- Create order via API
- Auto-process payment
- Show order success dengan order ID

#### Flow Customer:
```
1. Scan QR Code / Input Table Number
   ↓
2. Browse Menu & Add to Cart
   ↓
3. Checkout
   ↓
4. Pilih Payment Method
   ↓
5. Confirm Order
   ↓
6. Order Created & Paid
   ↓
7. Success! ✅
```

### Admin Dashboard ([admin.html](admin.html))

#### Login
- Login dengan username + password
- Session disimpan via cookie HttpOnly
- Ada tombol "Lupa password" untuk kirim link reset ke email admin

#### Tab 1: Orders
- List semua orders
- Filter by status (pending, paid, cancelled)
- Show detail: table, items count, total, payment method
- Real-time data dari backend

#### Tab 2: Menu
- **Categories Section:**
  - List semua categories
  - Add new category
  - Delete category

- **Menu Items Section:**
  - List menu items dengan harga, stok, availability
  - Add new menu item
  - Delete menu item
  - Assign category ke item

#### Tab 3: Tables
- Grid view semua meja
- Show table number, QR code, status
- Add new table
- Delete table
- Generate QR code (bisa di-print untuk di meja)

#### Tab 4: Reports
- **Daily Report:**
  - Pilih tanggal via date picker
  - Summary: total orders, revenue, avg order value
  - Revenue by payment method
  - Top selling items

## 🛠️ Teknologi yang Digunakan

### Libraries (via CDN - tidak perlu install)

1. **Tailwind CSS** - Modern CSS framework
   ```html
   <script src="https://cdn.tailwindcss.com"></script>
   ```
   - Utility-first CSS
   - Responsive by default
   - Modern styling

2. **html5-qrcode** - QR Code scanner library
   ```html
   <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
   ```
   - Support camera (front & back)
   - Cross-platform (Android, iOS, Desktop)
   - Easy to use

### Vanilla JavaScript (ES6+)
- No frameworks (React, Vue, Angular)
- Modern JavaScript features:
  - `async/await` untuk API calls
  - Arrow functions
  - Template literals
  - Destructuring
  - Spread operator
  - Array methods (map, filter, reduce)

### Browser APIs
- **Fetch API** - untuk HTTP requests ke backend
- **localStorage** - simpan cart data (persistent)
- **sessionStorage** - simpan table (temporary)
- **Camera API** - via html5-qrcode library

## 📝 Penjelasan File JavaScript

### 1. [config.js](js/config.js)

File ini berisi:
- **API_BASE_URL**: URL backend API
- **Helper Functions:**
  - `apiGet()` - GET request
  - `apiPost()` - POST request
  - `apiPatch()` - PATCH request
  - `apiDelete()` - DELETE request
  - `formatRupiah()` - Format number ke Rupiah
  - `formatDate()` - Format ISO date ke readable date
  - `showLoading()` - Show loading spinner
  - `showError()` - Show error message
  - `showSuccess()` - Show success toast
  - `showErrorAlert()` - Show error toast

**Semua function ini di-export ke `window` agar bisa digunakan di file lain.**

### 2. [customer.js](js/customer.js)

File ini berisi semua logic untuk customer page:

**Global Variables:**
- `html5QrCodeScanner` - Instance QR scanner
- `currentTable` - Data meja yang dipilih
- `cart` - Array cart items
- `categories` - Array categories
- `menuItems` - Array menu items
- `selectedCategory` - Category filter yang dipilih

**Functions:**
- **QR Scanner:**
  - `startQrScanner()` - Start camera scanner
  - `stopQrScanner()` - Stop scanner
  - `onScanSuccess()` - Callback ketika QR detected
  - `manualTableInput()` - Input table number manual

- **Table Management:**
  - `fetchTableByNumber()` - Fetch table dari API
  - `showTableInfo()` - Display table info
  - `changeTable()` - Ganti meja (clear cart)

- **Menu:**
  - `loadCategories()` - Load categories dari API
  - `renderCategoryTabs()` - Render category buttons
  - `filterByCategory()` - Filter menu by category
  - `loadMenuItems()` - Load menu items dari API
  - `renderMenuItems()` - Render menu cards
  - `increaseQuantity()` - Tambah quantity
  - `decreaseQuantity()` - Kurangi quantity

- **Cart:**
  - `addToCart()` - Tambah item ke cart
  - `updateCartUI()` - Update badge, total, dll
  - `renderCartItems()` - Render items di cart sidebar
  - `updateCartItemQuantity()` - Update quantity di cart
  - `removeFromCart()` - Hapus item dari cart
  - `toggleCart()` - Open/close cart sidebar

- **Checkout:**
  - `checkout()` - Buka checkout modal
  - `closeCheckoutModal()` - Tutup modal
  - `confirmOrder()` - Submit order ke API
  - `showSuccessModal()` - Show success message
  - `closeSuccessModal()` - Tutup success modal

### 3. [admin.js](js/admin.js)

File ini berisi semua logic untuk admin dashboard:

**Global Variables:**
- `adminUser` - Data admin setelah login
- `orders`, `categories`, `menuItems`, `tables` - Data caching
- `currentTab` - Tab yang sedang aktif

**Functions:**
- **Authentication:**
  - `login()` - Login dengan username + password
  - `logout()` - Logout admin
  - `showDashboard()` - Show dashboard setelah login

- **Tab Navigation:**
  - `showTab()` - Switch antar tab

- **Orders:**
  - `loadOrders()` - Load orders dari API
  - `renderOrders()` - Render orders list

- **Menu:**
  - `loadCategories()` - Load categories
  - `renderCategories()` - Render categories list
  - `showAddCategoryForm()` - Show form add category
  - `submitAddCategory()` - Submit add category
  - `deleteCategory()` - Delete category
  - `loadMenuItems()` - Load menu items
  - `renderMenuItems()` - Render items list
  - `showAddItemForm()` - Show form add item
  - `submitAddMenuItem()` - Submit add item
  - `deleteMenuItem()` - Delete item

- **Tables:**
  - `loadTables()` - Load tables dari API
  - `renderTables()` - Render tables grid
  - `showAddTableForm()` - Show form add table
  - `submitAddTable()` - Submit add table
  - `deleteTable()` - Delete table

- **Reports:**
  - `loadDailyReport()` - Load daily report dari API
  - `renderDailyReport()` - Render report data

- **Modal:**
  - `closeModal()` - Close modal

## 🎨 Customization

### Ganti Warna Theme

Edit di `config.js` atau langsung di HTML dengan Tailwind classes:

```javascript
// Primary color: blue-600
// Ganti semua: bg-blue-600 → bg-purple-600
// Ganti semua: text-blue-600 → text-purple-600
```

### Ganti Logo/Icon

Saat ini menggunakan emoji. Bisa diganti dengan image:

```html
<!-- Dari -->
<div class="text-6xl">☕</div>

<!-- Jadi -->
<img src="logo.png" alt="Logo" class="h-16 w-16">
```

### Tambah Field di Form

Contoh: Tambah field "description" di add menu item form.

1. Edit `admin.js` di function `showAddItemForm()`:
```javascript
// Tambah input di form
<div>
    <label>Deskripsi</label>
    <textarea id="item-description"></textarea>
</div>
```

2. Edit `submitAddMenuItem()`:
```javascript
const data = {
    // ... existing fields
    description: document.getElementById('item-description').value
};
```

## 🐛 Troubleshooting

### 1. QR Scanner Tidak Muncul

**Problem:** QR scanner tidak muncul atau error.

**Solution:**
- Pastikan browser support camera (gunakan Chrome/Edge/Safari)
- Allow camera permission ketika browser ask
- Gunakan HTTPS (camera hanya work di HTTPS atau localhost)
- Fallback: Gunakan manual table input

### 2. API Error 401 Unauthorized

**Problem:** Semua API call return 401.

**Solution:**
- Check API key di `config.js` sudah sesuai dengan backend `.env`
- Default: `Pempek-Yenny`
- Admin: Re-login dengan API key yang benar

### 3. CORS Error

**Problem:** Console error: "CORS policy blocked..."

**Solution:**
- Backend belum setup CORS dengan benar
- Check `src/app.ts` di backend, pastikan ada:
  ```javascript
  app.use(cors());
  ```

### 4. Cart Tidak Tersimpan

**Problem:** Cart hilang ketika refresh.

**Solution:**
- Check localStorage tidak disabled di browser
- Private/Incognito mode mungkin block localStorage
- Clear browser cache dan coba lagi

### 5. Data Tidak Load

**Problem:** Blank page atau loading terus.

**Solution:**
- Check console (F12) untuk error messages
- Pastikan backend running di `http://localhost:3000`
- Test backend dengan: `curl http://localhost:3000/health`
- Check network tab di browser DevTools

## 📱 Testing di Mobile

### Test QR Scanner di HP:

1. **Cara 1: Ngrok (Expose localhost ke internet)**
   ```bash
   # Install ngrok
   npm install -g ngrok

   # Expose backend
   ngrok http 3000

   # Dapat URL: https://xxxxx.ngrok.io
   ```

   Update `config.js`:
   ```javascript
   const API_BASE_URL = 'https://xxxxx.ngrok.io';
   ```

2. **Cara 2: Same Network**
   - Connect HP dan laptop ke WiFi yang sama
   - Check IP laptop: `ipconfig` (Windows) atau `ifconfig` (Mac/Linux)
   - Contoh IP: `192.168.1.10`
   - Update `config.js`:
     ```javascript
     const API_BASE_URL = 'http://192.168.1.10:3000';
     ```
   - Buka di HP: `http://192.168.1.10:3000/frontend/index.html`

### Generate QR Code untuk Testing:

Gunakan online QR generator:
1. Pergi ke: https://www.qr-code-generator.com/
2. Input text: `1` (untuk table number 1)
3. Download QR code
4. Print atau tampilkan di screen lain
5. Scan dengan HP menggunakan app Anda

## 🎓 Tips Belajar dari Code

### 1. Baca Comment di Setiap File

Semua file JavaScript sudah diberi **banyak comment** yang menjelaskan:
- Apa fungsi dari setiap function
- Kenapa code ditulis seperti itu
- Parameter yang diterima
- Return value

### 2. Mulai dari Flow Sederhana

Pelajari flow paling simple dulu:
1. Buka `index.html` → Lihat struktur HTML dasar
2. Baca `config.js` → Pahami helper functions
3. Pelajari 1 flow di `customer.js` (contoh: flow add to cart)

### 3. Experiment!

Coba ubah-ubah code:
- Ganti warna button
- Tambah field baru
- Ubah text/message
- Break code (error) lalu fix lagi (belajar debugging)

### 4. Gunakan Browser DevTools

- **Console (F12):** Lihat log, error
- **Network tab:** Lihat API calls
- **Application tab:** Lihat localStorage/sessionStorage
- **Elements tab:** Inspect HTML/CSS

### 5. Debug dengan console.log()

Tambahkan di code untuk debug:
```javascript
function addToCart(item) {
    console.log('🛒 Adding to cart:', item);
    console.log('📦 Current cart:', cart);
    // ... rest of code
}
```

## 📚 Resources untuk Belajar Lebih Lanjut

1. **JavaScript Modern:**
   - https://javascript.info/
   - https://www.freecodecamp.org/

2. **Tailwind CSS:**
   - https://tailwindcss.com/docs
   - https://tailwindcomponents.com/

3. **API & Fetch:**
   - https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

4. **QR Code Library:**
   - https://github.com/mebjas/html5-qrcode

## 🎉 Selamat!

Frontend sudah lengkap dan siap digunakan!

**Next Steps:**
1. Test semua fitur
2. Customize sesuai kebutuhan
3. Deploy ke hosting (Netlify, Vercel, GitHub Pages)
4. Add more features!

Good luck dengan skripsi Anda! 🚀
