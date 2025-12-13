# Cafe Scan Menu and Stock - Backend API

Backend REST API untuk sistem manajemen kafe dengan fitur scan QR code pada meja. Proyek ini memungkinkan customer untuk memesan menu dengan scan QR code di meja, dan admin dapat mengelola menu, stok, serta melihat laporan penjualan.

## Fitur Utama

### Untuk Customer:
- **Scan QR Code** - Scan QR di meja untuk mulai order
- **Lihat Menu** - Browse kategori dan menu items dengan harga
- **Buat Pesanan** - Order menu dengan pilihan quantity
- **Pembayaran** - Bayar dengan cash atau QRIS
- **Cancel Order** - Cancel order sebelum dibayar

### Untuk Admin:
- **Manajemen Meja** - CRUD meja dengan QR code
- **Manajemen Menu** - CRUD kategori dan menu items
- **Manajemen Stok** - Track dan update stok item
- **Monitor Orders** - Lihat semua pesanan (pending, paid, cancelled)
- **Laporan Penjualan** - Laporan harian dan ringkasan periode

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Validation**: Zod

## Prerequisites

- Node.js (v16 atau lebih baru)
- PostgreSQL database (bisa menggunakan Supabase)
- npm atau yarn

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables
Copy file `.env` dan edit dengan kredensial database Anda:
```env
PORT=3000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
ADMIN_API_KEY="my-secret-admin-key-123"
```

**Untuk mendapatkan DATABASE_URL dari Supabase:**
1. Buka project Supabase Anda
2. Pergi ke **Settings** → **Database**
3. Di bagian **Connection string**, pilih **URI**
4. Copy connection string dan paste ke `.env`

### 3. Setup Database
Generate Prisma client dan push schema ke database:
```bash
npm run prisma:generate
npm run prisma:push
```

### 4. Run Development Server
```bash
npm run dev
```

Server akan berjalan di: `http://localhost:3000`

### 5. Test API
Buka browser atau Postman dan test:
```
GET http://localhost:3000/health
```

Response:
```json
{
  "success": true,
  "message": "ok"
}
```

## Available Scripts

- `npm run dev` - Run development server dengan hot reload
- `npm run build` - Compile TypeScript ke JavaScript
- `npm start` - Run production build
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:push` - Push schema changes ke database
- `npm run prisma:studio` - Buka Prisma Studio (GUI database)

## Project Structure

```
Cafe-Scan-Menu-and-Stock/
├── src/
│   ├── index.ts                  # Entry point aplikasi
│   ├── app.ts                    # Express app setup
│   ├── db.ts                     # Prisma client instance
│   ├── middleware/
│   │   └── adminAuth.ts          # Admin authentication middleware
│   ├── utils/
│   │   ├── env.ts                # Environment utilities
│   │   └── errors.ts             # Error handling
│   ├── routes/
│   │   ├── health.routes.ts      # Health check
│   │   ├── tables.routes.ts      # Table management
│   │   ├── menu.routes.ts        # Menu management
│   │   ├── orders.routes.ts      # Order management
│   │   └── reports.routes.ts     # Reports
│   └── modules/
│       ├── tables/
│       │   └── tables.controller.ts
│       ├── menu/
│       │   └── menu.controller.ts
│       ├── orders/
│       │   └── orders.controller.ts
│       └── reports/
│           └── reports.controller.ts
├── prisma/
│   └── schema.prisma             # Database schema
├── .env                          # Environment variables
├── .env.example                  # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

### Public Endpoints (Customer)
- `GET /health` - Health check
- `GET /tables/by-number/:tableNumber` - Get table by number (QR scan)
- `GET /menu/categories` - List categories
- `GET /menu/items` - List menu items
- `POST /orders` - Create order
- `GET /orders/:id` - Get order detail
- `POST /orders/:id/pay` - Pay order
- `POST /orders/:id/cancel` - Cancel order

### Admin Endpoints (Requires API Key)
Header: `x-api-key: my-secret-admin-key-123`

- `GET /tables` - List tables
- `POST /tables` - Create table
- `PATCH /tables/:id` - Update table
- `DELETE /tables/:id` - Delete table
- `POST /menu/categories` - Create category
- `PATCH /menu/categories/:id` - Update category
- `DELETE /menu/categories/:id` - Delete category
- `POST /menu/items` - Create menu item
- `PATCH /menu/items/:id` - Update menu item
- `DELETE /menu/items/:id` - Delete menu item
- `GET /orders` - List all orders
- `GET /reports/daily?date=YYYY-MM-DD` - Daily report
- `GET /reports/summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` - Summary report

## Dokumentasi API Lengkap

Untuk dokumentasi API yang lebih detail, lihat [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

## Database Schema

### Tables
- **tables** - Data meja dengan QR code
- **menu_categories** - Kategori menu (Minuman, Makanan, dll)
- **menu_items** - Item menu dengan harga dan stok
- **orders** - Data pesanan dengan status
- **order_items** - Detail item yang dipesan
- **payments** - Record pembayaran

### Relationships
- One table → Many orders
- One category → Many menu items
- One order → Many order items
- One order → Many payments
- One menu item → Many order items

## Business Logic

### Order Flow:
1. Customer scan QR → Dapat table ID
2. Customer pilih menu items → Create order (status: pending)
3. Customer bayar → Order status menjadi "paid" + Stock berkurang + Payment record dibuat
4. Selesai!

### Stock Management:
- Stock di-check saat create order (pastikan cukup)
- Stock berkurang HANYA saat order dibayar (menggunakan transaction untuk atomicity)
- Stock tidak berkurang jika order di-cancel

## Error Handling

API menggunakan standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error, stock habis, etc)
- `401` - Unauthorized (API key salah)
- `404` - Not Found
- `409` - Conflict (duplicate entry)
- `500` - Internal Server Error

Response format:
```json
{
  "success": false,
  "message": "Error message here",
  "errors": [] // Optional, untuk validation errors
}
```

## Development Tips

### 1. Gunakan Prisma Studio
Prisma Studio adalah GUI untuk manage database:
```bash
npm run prisma:studio
```

### 2. Testing dengan Postman/Thunder Client
Import endpoints dari `API_DOCUMENTATION.md` ke Postman untuk testing.

### 3. Check Logs
Error logs akan muncul di console saat development mode.

### 4. Database Changes
Setiap kali ubah `prisma/schema.prisma`, jalankan:
```bash
npm run prisma:generate
npm run prisma:push
```

## Production Deployment

### 1. Build
```bash
npm run build
```

### 2. Set Environment Variables
Pastikan semua environment variables sudah di-set di production:
- `PORT`
- `DATABASE_URL`
- `ADMIN_API_KEY`

### 3. Run
```bash
npm start
```

### 4. Recommendations
- Gunakan process manager seperti PM2
- Setup reverse proxy dengan nginx
- Enable HTTPS
- Setup database backup schedule
- Monitor logs dengan logging service

## Security Notes

- **API Key**: Ganti `ADMIN_API_KEY` di production dengan value yang strong
- **Database URL**: Jangan commit `.env` ke git (sudah di-ignore via `.gitignore`)
- **CORS**: Configure CORS sesuai kebutuhan di `src/app.ts`
- **Rate Limiting**: Consider menambahkan rate limiting untuk production

## Troubleshooting

### Error: "Cannot find module 'express'"
```bash
npm install
```

### Error: "Prisma Client not generated"
```bash
npm run prisma:generate
```

### Error: "Database connection failed"
- Check `DATABASE_URL` di `.env`
- Pastikan database server running
- Test connection menggunakan Prisma Studio

### Error: "Port already in use"
- Ganti `PORT` di `.env`
- Atau kill process yang menggunakan port tersebut

## Contributing

Proyek ini untuk keperluan skripsi/tugas akhir. Untuk kontribusi atau pertanyaan, silakan buat issue atau contact developer.

## License

Private - Untuk keperluan akademis

## Contact

Untuk pertanyaan atau bantuan, silakan hubungi developer proyek ini.

---

**Happy Coding!**
