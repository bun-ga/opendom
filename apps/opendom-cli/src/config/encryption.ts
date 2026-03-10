import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const KEY_DIR = join(homedir(), ".config", "opendom");
export const KEY_FILE = join(KEY_DIR, "encryption.key");
export const SECRETS_FILE = join(KEY_DIR, "secrets.json");

let testKeyDir: string | null = null;
let testSecretsFile: string | null = null;

export function __setTestPaths(keyDir: string, secretsFile: string): void {
  testKeyDir = keyDir;
  testSecretsFile = secretsFile;
}

export function __clearTestPaths(): void {
  testKeyDir = null;
  testSecretsFile = null;
}

export function __getKeyDir(): string {
  return testKeyDir ?? KEY_DIR;
}

export function __getKeyFile(): string {
  return testKeyDir ? join(testKeyDir, "encryption.key") : KEY_FILE;
}

export function __getSecretsFile(): string {
  return testSecretsFile ?? SECRETS_FILE;
}

export function ensureDir(): void {
  const dir = __getKeyDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o600 });
  }
}

export function generateKey(): Buffer {
  const key = randomBytes(32);
  ensureDir();
  const keyFile = __getKeyFile();
  writeFileSync(keyFile, key, { mode: 0o600 });
  return key;
}

export function loadKey(): Buffer {
  ensureDir();
  const keyFile = __getKeyFile();
  if (!existsSync(keyFile)) {
    return generateKey();
  }
  const key = readFileSync(keyFile);
  if (key.length !== 32) {
    throw new Error("Invalid encryption key: expected 32 bytes");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, ciphertext]);
  return combined.toString("base64");
}

export function decrypt(encrypted: string): string {
  const key = loadKey();
  const combined = Buffer.from(encrypted, "base64");

  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export interface SecretStorageAdapter {
  read(account: string): string | undefined;
  write(account: string, value: string): boolean;
  remove(account: string): void;
}

interface SecretsStore {
  [account: string]: string;
}

function loadSecretsStore(): SecretsStore {
  ensureDir();
  const secretsFile = __getSecretsFile();
  if (!existsSync(secretsFile)) {
    return {};
  }
  try {
    const raw = readFileSync(secretsFile, "utf8");
    return JSON.parse(raw) as SecretsStore;
  } catch {
    return {};
  }
}

function saveSecretsStore(store: SecretsStore): void {
  ensureDir();
  const secretsFile = __getSecretsFile();
  writeFileSync(secretsFile, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export function createEncryptedSecretStorage(): SecretStorageAdapter {
  return {
    read(account: string): string | undefined {
      const store = loadSecretsStore();
      const encrypted = store[account];
      if (!encrypted) return undefined;
      try {
        return decrypt(encrypted);
      } catch {
        return undefined;
      }
    },
    write(account: string, value: string): boolean {
      try {
        const encrypted = encrypt(value);
        const store = loadSecretsStore();
        store[account] = encrypted;
        saveSecretsStore(store);
        return true;
      } catch {
        return false;
      }
    },
    remove(account: string): void {
      const store = loadSecretsStore();
      if (delete store[account]) {
        saveSecretsStore(store);
      }
    },
  };
}
