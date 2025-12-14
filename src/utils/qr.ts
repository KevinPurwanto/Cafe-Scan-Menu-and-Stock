import QRCode from "qrcode";

function buildTablePayload(tableNumber: number) {
  const base = process.env.CUSTOMER_QR_URL?.trim();
  if (!base) return String(tableNumber);

  try {
    const url = new URL(base);
    url.searchParams.set("table", String(tableNumber));
    return url.toString();
  } catch (_err) {
    // Fallback ke payload angka jika URL tidak valid
    return String(tableNumber);
  }
}

/**
 * Generate QR code image (data URL) for a table number.
 * Payload default: nomor meja (string).
 * Jika env CUSTOMER_QR_URL di-set, payload menjadi URL + query ?table=<number>.
 */
export async function generateTableQr(tableNumber: number) {
  const payload = buildTablePayload(tableNumber);
  return QRCode.toDataURL(payload, {
    margin: 1,
    errorCorrectionLevel: "M",
    scale: 8
  });
}
