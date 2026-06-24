# 📋 Analisis Proyek: Cafe Scan Menu & Stock (Menu QR Vicky)

## 🎯 Gambaran Umum

Ini adalah sistem **manajemen kafe berbasis QR Code** yang lengkap — pelanggan bisa scan QR di meja, lalu memesan langsung dari HP. Admin/staff bisa mengelola pesanan, menu, stok, dan laporan penjualan.

**Tech Stack:**
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL via **Prisma ORM** (hosted di Supabase)
- **Auth**: JWT disimpan sebagai **HttpOnly cookie**
- **Frontend**: HTML + Vanilla JS (multi-page)
- **Storage gambar**: Supabase Storage
- **Export laporan**: ExcelJS (xlsx/csv)
- **QR Code**: library `qrcode`
- **Email**: Nodemailer (SMTP)

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │customer  │  │ admin    │  │ kitchen  │  │  index   │  │
│  │.html     │  │ .html    │  │ .html    │  │  .html   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘  │
│       └──────────────┴─────────────┘                        │
│                   config.js + API helpers                    │
└───────────────────────────────┬─────────────────────────────┘
                                │ HTTP Fetch (JSON)
┌───────────────────────────────▼─────────────────────────────┐
│                     BACKEND (Express.js)                     │
│                                                             │
│  /auth    /menu    /orders    /tables    /reports    /health │
│     │        │         │          │          │              │
│  auth.   menu.     orders.    tables.    reports.           │
│  routes  routes    routes     routes     routes             │
│     │        │         │          │          │              │
│  (inline) menu.   orders.    tables.    reports.            │
│          ctrl     ctrl       ctrl       ctrl                │
│                                                             │
│  Middleware: adminAuth | staffAuth                          │
│  Utils: adminSession | staffSession | qr | errors | env    │
└───────────────────────────────┬─────────────────────────────┘
                                │ Prisma Client
┌───────────────────────────────▼─────────────────────────────┐
│              PostgreSQL (via Supabase)                       │
│  tables | menu_categories | menu_items | orders             │
│  order_items | payments | admin_users | admin_password_resets│
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Model Database

| Model | Deskripsi |
|---|---|
| `Table` | Meja kafe (nomor meja unik, QR code, aktif/tidak) |
| `MenuCategory` | Kategori menu (misal: Minuman, Makanan) |
| `MenuItem` | Item menu (nama, harga, stok, tersedia/arsip, gambar) |
| `Order` | Pesanan (dari meja tertentu, status: pending→validated→paid→served) |
| `OrderItem` | Detail item per pesanan (nama, qty, harga snapshot) |
| `Payment` | Record pembayaran (metode: cash/qris) |
| `AdminUser` | Akun admin/owner/staff/kitchen |
| `AdminPasswordReset` | Token reset password (hash SHA-256, TTL) |

### Alur Status Pesanan:
```
pending → validated → paid → served
   ↓           ↓         ↓
cancelled   cancelled  (unserve → kembali ke validated/paid)
```

---

## 🔐 Sistem Autentikasi

Terdapat **dua tier session** terpisah:

| | Admin Session | Staff Session |
|---|---|---|
| Cookie name | `admin_session` | `staff_session` |
| Roles diizinkan | `admin`, `owner` | `admin`, `owner`, `kitchen`, `staff` |
| Secret env | `ADMIN_JWT_SECRET` | `STAFF_JWT_SECRET` |
| TTL default | 7 hari | 7 hari |
| Storage | HttpOnly Cookie | HttpOnly Cookie |

**Middleware:**
- `adminAuth` — hanya admin & owner
- `staffAuth` — admin, owner, kitchen, staff

---

## 📡 API Endpoints

### Auth (`/auth`)
| Method | Endpoint | Akses |
|---|---|---|
| GET | `/admin/me` | Admin |
| POST | `/admin/login` | Public |
| POST | `/admin/logout` | Public |
| POST | `/admin/forgot-password` | Public |
| POST | `/admin/reset-password` | Public |
| POST | `/admin/users` | Admin (buat akun baru) |
| GET | `/staff/me` | Staff |
| POST | `/staff/login` | Public |
| POST | `/staff/logout` | Public |
| POST | `/staff/forgot-password` | Public |

### Menu (`/menu`)
| Method | Endpoint | Akses |
|---|---|---|
| GET | `/categories` | Public |
| GET | `/items` | Public |
| POST | `/categories` | Admin |
| PATCH | `/categories/:id` | Admin |
| DELETE | `/categories/:id` | Admin |
| POST | `/items` | Admin |
| PATCH | `/items/:id` | Admin |
| DELETE | `/items/:id` | Admin (soft delete → isArchived=true) |

### Orders (`/orders`)
| Method | Endpoint | Akses |
|---|---|---|
| POST | `/` | Public (customer via QR) |
| GET | `/:id` | Public |
| POST | `/:id/cancel` | Public (hanya status pending) / Admin (status validated) |
| GET | `/` | Staff |
| POST | `/:id/validate` | Admin (kurangi stok) |
| PATCH | `/:id/items` | Admin (edit sebelum paid) |
| POST | `/:id/pay` | Admin (cash/qris) |
| POST | `/:id/serve` | Staff |
| POST | `/:id/unserve` | Staff |

### Tables (`/tables`)
| Method | Endpoint | Akses |
|---|---|---|
| GET | `/` | Admin |
| GET | `/number/:tableNumber` | Public |
| POST | `/` | Admin (generate QR otomatis) |
| PATCH | `/:id` | Admin |
| DELETE | `/:id` | Admin |

### Reports (`/reports`)
| Method | Endpoint | Akses |
|---|---|---|
| GET | `/daily` | Admin |
| GET | `/summary` | Admin |
| GET | `/export` | Admin (CSV/XLSX) |

---

## 🖥️ Frontend Pages

| File | Fungsi |
|---|---|
| `customer.html` + `customer.js` | Halaman customer: scan QR → lihat menu → pesan → bayar |
| `admin.html` + `admin.js` | Dashboard admin: kelola menu, pesanan, meja, laporan |
| `kitchen.html` + `kitchen.js` | View dapur: lihat & update status pesanan |
| `index.html` | Landing page (redirect ke `/customer`) |
| `reset-password.html` | Form reset password |

### Frontend Pattern:
- Semua halaman pakai `config.js` sebagai shared helper
- Helper global: `apiGet`, `apiPost`, `apiPatch`, `apiDelete`, `formatRupiah`, `formatDate`, `showSuccess`, `showError`
- API Base URL auto-detect dari `window.location.origin`
- Gambar menu disimpan di **Supabase Storage**

---

## 🔄 Alur Utama: Customer Memesan

```
1. Customer scan QR code di meja
   → URL: /customer?table=<nomor>

2. Frontend fetch GET /tables/number/:tableNumber
   → Validasi meja aktif, ambil tableId

3. Customer lihat menu: GET /menu/items
   → Filter: isAvailable=true, isArchived=false

4. Customer tambah ke cart → POST /orders
   {tableId, items: [{menuItemId, quantity}], paymentMethod}
   → Backend validasi stok, hitung total, simpan order (status: "pending")

5. Admin melihat pesanan baru di dashboard → POST /orders/:id/validate
   → Stok dikurangi, status → "validated"

6. Admin proses pembayaran → POST /orders/:id/pay {method: "cash"|"qris"}
   → Status → "paid", buat Payment record

7. Staff/kitchen antar pesanan → POST /orders/:id/serve
   → Status → "served"
```

---

## ⚙️ Konfigurasi Environment (`.env`)

| Variabel | Fungsi |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (via pooler Supabase) |
| `DIRECT_URL` | Direct connection ke PostgreSQL |
| `ADMIN_JWT_SECRET` | Secret untuk JWT admin session |
| `STAFF_JWT_SECRET` | Secret untuk JWT staff session |
| `ADMIN_PASSWORD` | Password default admin saat seed |
| `ADMIN_RESET_EMAIL` | Email tujuan link reset password |
| `SMTP_HOST/PORT/USER/PASS` | Konfigurasi email SMTP |
| `CUSTOMER_QR_URL` | Base URL yang diencode ke QR code |
| `APP_BASE_URL` | Base URL aplikasi (untuk reset email link) |

---

## 🛠️ Scripts NPM

| Script | Fungsi |
|---|---|
| `npm run dev` | Jalankan server dev (tsx watch) |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm start` | Jalankan dari `dist/` (production) |
| `npm run db:setup` | Generate Prisma + push schema + seed |
| `npm run prisma:studio` | Buka Prisma Studio (GUI database) |

---

## 📌 Hal Menarik / Catatan Teknis

1. **Soft delete**: Menu item tidak dihapus permanen — di-archive (`isArchived=true`)
2. **Snapshot harga**: `OrderItem.price` dan `menuName` disimpan saat order dibuat — jadi harga tidak berubah walau menu diupdate
3. **Stok dikurangi saat validate**, bukan saat order dibuat — ini mencegah "phantom order"
4. **Cancel validated order** hanya bisa dilakukan admin, dan otomatis mengembalikan stok
5. **Edit order items** saat status `validated` akan menyesuaikan stok secara delta
6. **Reset password** pakai SHA-256 hash dari random token 32 bytes, TTL configurable
7. **QR Code** diencode sebagai data URL base64 dan disimpan di database
8. **Dua session cookie terpisah** memungkinkan seseorang login sebagai admin sekaligus staff
