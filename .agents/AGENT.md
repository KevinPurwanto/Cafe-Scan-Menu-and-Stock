# Cafe Scan — Menu QR & Stock Management System
## Deskripsi Proyek
Aplikasi POS (Point of Sale) untuk cafe/restoran bernama **"Pempek Yenny"** yang memungkinkan:
- **Customer**: Scan QR code di meja → lihat menu → pesan langsung dari HP
- **Admin/Owner**: Kelola menu, stok, pesanan, produksi, dan lihat laporan penjualan
- **Kitchen/Staff**: Lihat dan kelola antrian pesanan yang masuk
## Tech Stack
| Layer       | Teknologi                                    |
|-------------|----------------------------------------------|
| Backend     | **Express.js** + **TypeScript** (CommonJS)   |
| Database    | **PostgreSQL** via **Prisma ORM** (v6)       |
| Frontend    | **Vanilla HTML/CSS/JS** (no framework)       |
| Hosting DB  | **Supabase** (PostgreSQL + Storage)          |
| Auth        | **JWT** (jsonwebtoken + bcryptjs)             |
| Validation  | **Zod**                                      |
| Dev Server  | **tsx watch** (`npm run dev`)                |
| QR Code     | **qrcode** library                           |
| Reports     | **ExcelJS** (export laporan ke Excel)        |
| Email       | **Nodemailer** (reset password via SMTP)     |
## Cara Menjalankan
```bash
npm install
npm run prisma:generate   # Generate Prisma client
npm run dev               # tsx watch src/index.ts → http://localhost:3000
```
Server auto-run `prisma db push` saat startup (lihat `src/index.ts`).
## Struktur Direktori
```
├── src/                        # Backend TypeScript source
│   ├── app.ts                  # Express app factory (routes, middleware, static files)
│   ├── index.ts                # Entry point (auto-migration, listen port)
│   ├── db.ts                   # Prisma client singleton
│   ├── middleware/
│   │   ├── adminAuth.ts        # JWT auth → role admin/owner
│   │   └── staffAuth.ts        # JWT/API-key auth → admin atau staff/kitchen
│   ├── modules/                # Business logic (controller per domain)
│   │   ├── admin/              # admin.seed.ts (auto-seed admin user saat startup)
│   │   ├── menu/               # menu.controller.ts (CRUD kategori & item, low-stock)
│   │   ├── orders/             # orders.controller.ts (create, validate, pay, serve, cancel)
│   │   ├── tables/             # tables.controller.ts (CRUD meja + QR code)
│   │   ├── reports/            # reports.controller.ts (laporan penjualan, Excel export)
│   │   ├── production/         # production.controller.ts (rencana produksi harian)
│   │   └── potentialLoss/      # potentialLoss.controller.ts (catat potential loss stok)
│   ├── routes/                 # Express Router per domain
│   │   ├── auth.routes.ts      # Login, logout, register, reset password
│   │   ├── menu.routes.ts
│   │   ├── orders.routes.ts
│   │   ├── tables.routes.ts
│   │   ├── reports.routes.ts
│   │   ├── production.routes.ts
│   │   ├── potentialLoss.routes.ts
│   │   └── health.routes.ts
│   ├── utils/
│   │   ├── adminSession.ts     # JWT session helper (admin)
│   │   ├── staffSession.ts     # JWT session helper (staff/kitchen)
│   │   ├── errors.ts           # HttpError class, asyncHandler, errorHandler
│   │   ├── env.ts              # requireEnv() helper
│   │   └── qr.ts               # QR code generation
│   └── types/
│       └── bcryptjs.d.ts       # Type declaration for bcryptjs
│
├── prisma/
│   ├── schema.prisma           # Database schema (9 model)
│   ├── seed.ts / seed.js       # Seed script
│   └── seed-data.json          # Data seed
│
├── frontend/                   # Static HTML frontend (served oleh Express)
│   ├── index.html              # Landing page
│   ├── customer.html           # Halaman customer (QR scan → menu → order)
│   ├── admin.html              # Dashboard admin (menu, stok, pesanan, laporan)
│   ├── kitchen.html            # Dashboard kitchen (antrian pesanan)
│   ├── reset-password.html     # Form reset password
│   ├── css/style.css           # Global styles
│   └── js/
│       ├── config.js           # API helper (apiGet, apiPost, dll), format Rupiah
│       ├── admin.js            # Logic admin dashboard (~113KB, besar)
│       ├── customer.js         # Logic customer page
│       ├── kitchen.js          # Logic kitchen dashboard
│       └── reset-password.js   # Logic reset password
│
├── dist/                       # Compiled JS output (tsc)
├── package.json
├── tsconfig.json
└── .env / .env.example
```
## Database Schema (Prisma)
9 model utama:
| Model                | Tabel DB              | Deskripsi                              |
|----------------------|-----------------------|----------------------------------------|
| `Table`              | `tables`              | Meja + QR code                         |
| `MenuCategory`       | `menu_categories`     | Kategori menu (Makanan, Minuman, dll)  |
| `MenuItem`           | `menu_items`          | Item menu + harga + stok               |
| `Order`              | `orders`              | Pesanan (pending → validated → served) |
| `OrderItem`          | `order_items`         | Item dalam pesanan                     |
| `Payment`            | `payments`            | Pembayaran order                       |
| `AdminUser`          | `admin_users`         | User admin/owner                       |
| `AdminPasswordReset` | `admin_password_resets`| Token reset password                  |
| `PotentialLoss`      | `potential_losses`    | Log potential loss (stok tidak cukup)  |
| `Production`         | `productions`         | Rencana/log produksi harian            |
### Relasi Utama
- `Table` 1→N `Order`
- `MenuCategory` 1→N `MenuItem`
- `Order` 1→N `OrderItem`, `Order` 1→N `Payment`
- `MenuItem` 1→N `OrderItem`, `MenuItem` 1→N `Production`
- `AdminUser` 1→N `AdminPasswordReset`
### Order Status Flow
```
pending → validated → served
pending → cancelled
```
### Harga & Mata Uang
- Semua harga dalam **Integer (Rupiah)**, bukan decimal
- Format display: `Rp 15.000` via `formatRupiah()` di `config.js`
## API Routes
| Prefix            | Auth         | Deskripsi                              |
|--------------------|-------------|----------------------------------------|
| `GET /health`      | —           | Health check                           |
| `/auth/*`          | Mixed       | Login, register, logout, reset password|
| `/menu/*`          | Public/Admin| GET public, CUD admin-only             |
| `/orders/*`        | Mixed       | POST/GET public, manage admin/staff    |
| `/tables/*`        | Admin       | CRUD meja + generate QR                |
| `/reports/*`       | Admin       | Laporan penjualan + Excel export       |
| `/production/*`    | Admin       | Rencana produksi harian                |
| `/potential-loss/*`| Admin       | Log potential loss                     |
## Pola Arsitektur & Konvensi
### Backend Pattern
- **Route → Controller** pattern (tanpa service layer terpisah)
- Route file: `src/routes/<domain>.routes.ts` — hanya routing + middleware
- Controller file: `src/modules/<domain>/<domain>.controller.ts` — business logic + Prisma query
- Semua async handler dibungkus `asyncHandler()` dari `utils/errors.ts`
- Validasi input pakai **Zod schema** di dalam controller
- Error handling via `HttpError` class + global `errorHandler` middleware
- Response format konsisten: `{ success: true, data: ... }` atau `{ success: false, message: "..." }`
### Auth Pattern
- **Admin auth**: JWT token di header `Authorization: Bearer <token>`
  - Middleware: `adminAuth` — cek role `admin` atau `owner`
  - Session helper: `utils/adminSession.ts`
- **Staff/Kitchen auth**: JWT token ATAU `x-api-key` header
  - Middleware: `staffAuth` — cek admin session, staff session, atau kitchen API key
  - Session helper: `utils/staffSession.ts`
- Auto-seed admin user saat startup via `modules/admin/admin.seed.ts`
### Frontend Pattern
- Vanilla JS, **tanpa bundler/framework**
- Semua helper di `config.js` di-attach ke `window` object (e.g., `window.apiGet`, `window.formatRupiah`)
- `apiRequest()` di `config.js` = wrapper `fetch()` dengan default JSON headers + error handling
- Admin token disimpan di `localStorage` sebagai `adminToken`
- Supabase digunakan untuk **image storage** (menu item images)
### Prisma Conventions
- Field naming: camelCase di Prisma, snake_case di DB via `@map()`
- Semua ID: UUID (`@default(uuid())`)
- Soft delete pada `MenuItem`: `isArchived: true` (bukan hard delete)
- `@map("table_name")` pada setiap model
## Environment Variables Penting
| Variable              | Deskripsi                                    |
|-----------------------|----------------------------------------------|
| `DATABASE_URL`        | PostgreSQL connection string (Supabase)      |
| `DIRECT_URL`          | Direct PostgreSQL URL (untuk Prisma migrate) |
| `ADMIN_JWT_SECRET`    | Secret key untuk JWT admin                   |
| `CUSTOMER_QR_URL`     | Base URL untuk QR code customer              |
| `ADMIN_SEED_*`        | Kredensial auto-seed admin user              |
| `KITCHEN_SEED_*`      | Kredensial auto-seed kitchen user             |
| `KITCHEN_API_KEY`     | API key untuk kitchen auth                   |
| `SMTP_*`              | Konfigurasi email (reset password)           |
| `SUPABASE_URL`        | URL Supabase (di config.js frontend)         |
| `SUPABASE_ANON_KEY`   | Anon key Supabase (di config.js frontend)    |
## Hal Penting / Gotchas
1. **`admin.js` sangat besar (~113KB)** — file ini monolitik, berisi semua logic dashboard admin. Hati-hati saat edit, pastikan tidak merusak fungsi lain.
2. **Auto-migration saat startup** — `src/index.ts` menjalankan `npx prisma db push` otomatis. Jangan kaget kalau startup agak lambat.
3. **Soft delete untuk MenuItem** — `removeItem()` tidak menghapus dari DB, hanya set `isArchived: true` dan `isAvailable: false`.
4. **Harga Integer** — Semua harga dalam satuan Rupiah penuh (bukan desimal). Tidak ada pembulatan.
5. **Frontend served dari backend** — Express serve static files dari folder `frontend/`. Root `/` redirect ke `/customer`.
6. **Dua sistem session** — `adminSession.ts` dan `staffSession.ts` terpisah, dengan TTL dan secret yang bisa berbeda.
7. **Supabase keys di frontend** — `SUPABASE_URL` dan `SUPABASE_ANON_KEY` ada di `config.js` (client-side). Ini normal karena anon key memang untuk public access.
8. **Module type CommonJS** — Project ini pakai `"type": "commonjs"` di package.json dan `"module": "CommonJS"` di tsconfig. Import/export pakai CommonJS style di compiled output.
## Bahasa
- Kode dan komentar campuran **Bahasa Indonesia dan Inggris**
- UI frontend dalam **Bahasa Indonesia**
- Komunikasi dengan user preferably dalam **Bahasa Indonesia**
