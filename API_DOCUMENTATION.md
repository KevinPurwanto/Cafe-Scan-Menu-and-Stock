# API Documentation - Cafe Scan Menu and Stock

Backend REST API untuk sistem manajemen kafe dengan fitur scan QR code.

## Base URL
```
http://localhost:3000
```

## Authentication

Endpoint admin memerlukan header `x-api-key`:
```
x-api-key: my-secret-admin-key-123
```

---

## 1. Health Check

### GET /health
Check status API

**Response:**
```json
{
  "success": true,
  "message": "ok"
}
```

---

## 2. Tables (Meja)

### GET /tables/by-number/:tableNumber
Get table by number (untuk QR code scanning - PUBLIC)

**Parameters:**
- `tableNumber` (number): Nomor meja

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tableNumber": 1,
    "qrCode": "QR_TABLE_1",
    "isActive": true,
    "createdAt": "2025-12-13T10:00:00.000Z"
  }
}
```

### GET /tables
List semua meja (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tableNumber": 1,
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "isActive": true,
      "createdAt": "2025-12-13T10:00:00.000Z"
    }
  ]
}
```

`qrCode` berisi data URL PNG yang sudah digenerate otomatis dari nomor meja.

### POST /tables
Buat meja baru (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Body:**
```json
{
  "tableNumber": 1,
  "isActive": true
}
```

QR code akan dibuat otomatis berdasarkan nomor meja dan disimpan di database.

### PATCH /tables/:id
Update meja (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Body:**
```json
{
  "tableNumber": 2,
  "isActive": false,
  "regenerateQr": true
}
```

QR akan otomatis digenerate ulang jika `tableNumber` berubah atau `regenerateQr` diset `true`.

### DELETE /tables/:id
Hapus meja (ADMIN)

---

## 3. Menu

### GET /menu/categories
List semua kategori menu (PUBLIC)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Minuman",
      "createdAt": "2025-12-13T10:00:00.000Z",
      "_count": {
        "items": 5
      }
    }
  ]
}
```

### GET /menu/items
List menu items (PUBLIC)

**Query Parameters:**
- `category_id` (optional): Filter by category ID
- `only_available` (optional, default: true): Show only available items

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "categoryId": "uuid",
      "name": "Kopi Susu",
      "price": 15000,
      "stock": 100,
      "isAvailable": true,
      "createdAt": "2025-12-13T10:00:00.000Z",
      "category": {
        "id": "uuid",
        "name": "Minuman"
      }
    }
  ]
}
```

### POST /menu/categories
Buat kategori baru (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Body:**
```json
{
  "name": "Minuman"
}
```

### PATCH /menu/categories/:id
Update kategori (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Body:**
```json
{
  "name": "Makanan"
}
```

### DELETE /menu/categories/:id
Hapus kategori (ADMIN)
- Kategori tidak bisa dihapus jika masih ada menu items

### POST /menu/items
Buat menu item baru (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Body:**
```json
{
  "categoryId": "uuid",
  "name": "Kopi Susu",
  "price": 15000,
  "stock": 100,
  "isAvailable": true
}
```

### PATCH /menu/items/:id
Update menu item (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Body:**
```json
{
  "name": "Kopi Susu Premium",
  "price": 20000,
  "stock": 50,
  "isAvailable": false
}
```

### DELETE /menu/items/:id
Hapus menu item (ADMIN)
- Item tidak bisa dihapus jika ada pending orders

---

## 4. Orders (Pesanan)

### POST /orders
Buat order baru (PUBLIC - Customer via QR)

**Body:**
```json
{
  "tableId": "uuid",
  "items": [
    {
      "menuItemId": "uuid",
      "quantity": 2
    },
    {
      "menuItemId": "uuid",
      "quantity": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tableId": "uuid",
    "status": "pending",
    "totalPrice": 50000,
    "paymentMethod": null,
    "createdAt": "2025-12-13T10:00:00.000Z",
    "table": {...},
    "items": [
      {
        "id": "uuid",
        "orderId": "uuid",
        "menuItemId": "uuid",
        "quantity": 2,
        "price": 15000,
        "menuItem": {...}
      }
    ]
  }
}
```

### GET /orders/:id
Get order detail (PUBLIC)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tableId": "uuid",
    "status": "pending",
    "totalPrice": 50000,
    "paymentMethod": null,
    "createdAt": "2025-12-13T10:00:00.000Z",
    "table": {...},
    "items": [...],
    "payments": [...]
  }
}
```

### GET /orders
List semua orders (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Query Parameters:**
- `status` (optional): Filter by status (pending, paid, cancelled)
- `table_id` (optional): Filter by table ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tableId": "uuid",
      "status": "paid",
      "totalPrice": 50000,
      "paymentMethod": "qris",
      "createdAt": "2025-12-13T10:00:00.000Z",
      "table": {...},
      "_count": {
        "items": 3
      }
    }
  ]
}
```

### POST /orders/:id/pay
Bayar order (PUBLIC)
- Order status akan berubah menjadi "paid"
- Stock menu items akan berkurang
- Payment record akan dibuat

**Body:**
```json
{
  "method": "cash"
}
```
atau
```json
{
  "method": "qris"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "status": "paid",
      "paymentMethod": "cash",
      ...
    },
    "payment": {
      "id": "uuid",
      "orderId": "uuid",
      "method": "cash",
      "status": "success",
      "paidAt": "2025-12-13T10:30:00.000Z"
    }
  }
}
```

### POST /orders/:id/cancel
Cancel order (PUBLIC)
- Hanya bisa cancel order dengan status "pending"

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "cancelled",
    ...
  }
}
```

---

## 5. Reports (Laporan)

### GET /reports/daily
Laporan harian (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Query Parameters:**
- `date` (required): Format YYYY-MM-DD (contoh: 2025-12-13)

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2025-12-13",
    "summary": {
      "totalOrders": 15,
      "totalRevenue": 500000,
      "averageOrderValue": 33333
    },
    "revenueByMethod": {
      "cash": 300000,
      "qris": 200000
    },
    "revenueByTable": {
      "1": { "revenue": 100000, "orders": 3 },
      "2": { "revenue": 150000, "orders": 5 }
    },
    "topItems": [
      {
        "name": "Kopi Susu",
        "quantity": 25,
        "revenue": 375000,
        "category": "Minuman"
      }
    ]
  }
}
```

### GET /reports/summary
Laporan ringkasan periode (ADMIN)

**Headers:**
```
x-api-key: my-secret-admin-key-123
```

**Query Parameters:**
- `start_date` (optional): Format YYYY-MM-DD (default: 30 hari lalu)
- `end_date` (optional): Format YYYY-MM-DD (default: hari ini)

**Response:**
```json
{
  "success": true,
  "data": {
    "dateRange": {
      "startDate": "2025-11-13",
      "endDate": "2025-12-13"
    },
    "summary": {
      "totalOrders": 450,
      "totalRevenue": 15000000,
      "averageOrderValue": 33333
    },
    "revenueByMethod": {
      "cash": { "count": 250, "revenue": 8500000 },
      "qris": { "count": 200, "revenue": 6500000 }
    },
    "revenueByCategory": {
      "Minuman": { "revenue": 9000000, "itemsSold": 1200 },
      "Makanan": { "revenue": 6000000, "itemsSold": 800 }
    },
    "inventory": {
      "totalMenuItems": 45,
      "totalCategories": 8,
      "totalTables": 20
    }
  }
}
```

---

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "items.0.quantity",
      "message": "Number must be greater than 0"
    }
  ]
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### Not Found (404)
```json
{
  "success": false,
  "message": "Order not found"
}
```

### Conflict (409)
```json
{
  "success": false,
  "message": "Duplicate entry. Record already exists."
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Internal Server Error"
}
```

---

## Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup .env
Edit file `.env` dan isi dengan kredensial database Supabase Anda:
```
PORT=3000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
ADMIN_API_KEY="my-secret-admin-key-123"
```

### 3. Generate Prisma Client
```bash
npm run prisma:generate
```

### 4. Push Schema ke Database
```bash
npm run prisma:push
```

### 5. Run Development Server
```bash
npm run dev
```

Server akan berjalan di: `http://localhost:3000`

### 6. Build untuk Production
```bash
npm run build
npm start
```

---

## Alur Penggunaan Sistem

### Untuk Admin:
1. Setup meja dengan QR code (`POST /tables`)
2. Buat kategori menu (`POST /menu/categories`)
3. Tambah menu items (`POST /menu/items`)
4. Monitor orders (`GET /orders`)
5. Lihat laporan (`GET /reports/daily` atau `/reports/summary`)

### Untuk Customer:
1. Scan QR code di meja → dapat table ID
2. Lihat menu (`GET /menu/items`)
3. Buat order (`POST /orders`)
4. Bayar order (`POST /orders/:id/pay`)
5. Selesai!

---

## Testing dengan Postman/Thunder Client

### Test Health Check
```
GET http://localhost:3000/health
```

### Test Create Table (Admin)
```
POST http://localhost:3000/tables
Headers:
  x-api-key: my-secret-admin-key-123
Body:
{
  "tableNumber": 1,
  "isActive": true
}
```

`qrCode` tidak perlu dikirim; backend otomatis membuat gambar QR dan menyimpannya.

### Test Create Order (Customer)
```
POST http://localhost:3000/orders
Body:
{
  "tableId": "<table-id-from-previous-step>",
  "items": [
    {
      "menuItemId": "<menu-item-id>",
      "quantity": 2
    }
  ]
}
```
