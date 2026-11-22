// 2FA por TOTP (RFC 6238) — o mesmo padrão do Google Authenticator / Authy.
// Implementação própria (pequena) para saber QUAL código foi aceito e impedir que ele seja reutilizado.
import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=]/g, '');
  let bits = '';
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error('Segredo 2FA inválido.');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Novo segredo aleatório (160 bits, como recomenda a RFC 4226). */
export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(bin).padStart(DIGITS, '0');
}

export const currentCounter = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / STEP_SECONDS);

/** Gera o código de um instante (usado nos testes). */
export const totpAt = (secret: string, nowMs: number) => hotp(base32Decode(secret), currentCounter(nowMs));

/**
 * Confere o código aceitando 30 s de diferença no relógio do celular (janela -1, 0, +1).
 * Devolve o "contador" do código aceito, ou null se for inválido.
 * Códigos com contador <= lastCounter já foram usados e são recusados.
 */
export function verifyTotp(secret: string, code: string, lastCounter?: number | null, nowMs = Date.now()): number | null {
  const token = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(token)) return null;
  let key: Buffer;
  try { key = base32Decode(secret); } catch { return null; }
  const now = currentCounter(nowMs);
  for (const c of [now, now - 1, now + 1]) {
    if (lastCounter != null && c <= lastCounter) continue;
    const expected = hotp(key, c);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))) return c;
  }
  return null;
}

/** Link otpauth:// que o Google Authenticator entende (vira o QR Code). */
export function otpauthUri(secret: string, account: string, issuer = 'BARBERSHOP L.A'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
