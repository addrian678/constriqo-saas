import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import argon2 from "argon2";

const SESSION_TOKEN_BYTES = 32;
const TOTP_SECRET_BYTES = 20;
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token, pepper = process.env.SESSION_TOKEN_PEPPER || "") {
  return createHash("sha256").update(`${pepper}${token}`, "utf8").digest("hex");
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash.startsWith("$argon2")) {
    return false;
  }

  return argon2.verify(passwordHash, password);
}

export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(TOTP_SECRET_BYTES));
}

export function createTotpAuthUri({ issuer, accountName, secret }) {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });

  return `otpauth://totp/${label}?${query.toString()}`;
}

export function verifyTotpCode({ secret, code, now = Date.now(), window = 1 }) {
  const normalizedCode = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/u.test(normalizedCode)) {
    return false;
  }

  const counter = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  for (let offset = -window; offset <= window; offset += 1) {
    if (generateTotpCode(secret, counter + offset) === normalizedCode) {
      return true;
    }
  }

  return false;
}

export function generateCurrentTotpCode(secret, now = Date.now()) {
  return generateTotpCode(secret, Math.floor(now / 1000 / TOTP_STEP_SECONDS));
}

export function encryptSecret(plaintext, keyMaterial = process.env.AUTH_MFA_ENCRYPTION_KEY || process.env.SESSION_TOKEN_PEPPER || "") {
  const key = deriveEncryptionKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptSecret({ ciphertext, iv, tag }, keyMaterial = process.env.AUTH_MFA_ENCRYPTION_KEY || process.env.SESSION_TOKEN_PEPPER || "") {
  const key = deriveEncryptionKey(keyMaterial);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

function deriveEncryptionKey(keyMaterial) {
  if (!keyMaterial || keyMaterial === "change-me-long-random-secret") {
    if (process.env.APP_ENV === "production") {
      throw new Error("AUTH_MFA_ENCRYPTION_KEY or SESSION_TOKEN_PEPPER must be configured for production MFA.");
    }
  }

  return createHash("sha256").update(String(keyMaterial || "development-only-mfa-key"), "utf8").digest();
}

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(secret) {
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of String(secret || "").replace(/=+$/u, "").toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid TOTP secret.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateTotpCode(secret, counter) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}
