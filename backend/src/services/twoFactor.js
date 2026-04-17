import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32ToBuffer(base32) {
  const clean = (base32 || '').replace(/=+$/g, '').toUpperCase();
  let bits = '';
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx >= 0) bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateHotp(secretBase32, counter, digits = 6) {
  const key = base32ToBuffer(secretBase32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return (code % (10 ** digits)).toString().padStart(digits, '0');
}

export function generateTwoFactorSecret(email) {
  const secret = toBase32(crypto.randomBytes(20));
  const issuer = encodeURIComponent('SoloCompass');
  const label = encodeURIComponent(`SoloCompass:${email}`);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const qrCodeDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='100%' height='100%' fill='white'/><text x='12' y='24' font-size='12' font-family='monospace'>Scan in Authenticator:</text><foreignObject x='12' y='36' width='276' height='252'><div xmlns='http://www.w3.org/1999/xhtml' style='font-size:10px;word-wrap:break-word;font-family:monospace;'>${otpauthUrl}</div></foreignObject></svg>`,
  )}`;
  return { secret, otpauthUrl, qrCodeDataUri };
}

export function verifyTwoFactorCode(secret, code, window = 1) {
  if (!secret || !code) return false;
  const step = 30;
  const counter = Math.floor(Date.now() / 1000 / step);
  for (let i = -window; i <= window; i += 1) {
    const expected = generateHotp(secret, counter + i);
    if (expected === String(code).trim()) return true;
  }
  return false;
}

