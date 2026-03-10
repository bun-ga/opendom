import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  __clearTestPaths,
  __setTestPaths,
  createEncryptedSecretStorage,
  decrypt,
  encrypt,
  generateKey,
  loadKey,
} from "../src/encryption.js";

describe("encryption", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "opendom-encryption-test-"));
    __setTestPaths(testDir, join(testDir, "secrets.json"));
  });

  afterEach(() => {
    __clearTestPaths();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("encrypt/decrypt roundtrip", () => {
    it("encrypts and decrypts a basic string", () => {
      const plaintext = "Hello, World!";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts an empty string", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts a very long string (10KB+)", () => {
      const plaintext = "a".repeat(15000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(15000);
    });

    it("encrypts and decrypts unicode characters including emojis", () => {
      const plaintext = "Hello 🌍 你好 🔐 ״שלום 🎉 مرحبا";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts special characters", () => {
      const plaintext = "Line1\nLine2\tTabbed\r\nWindows\rMac\nUnix\nEnd";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts quotes and backslashes", () => {
      const plaintext = 'He said "Hello" and \\escaped\\';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts null bytes", () => {
      const plaintext = "before\0after\0end";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts base64-like strings with all characters", () => {
      const plaintext =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/==";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts JSON strings", () => {
      const plaintext = JSON.stringify({
        name: "test",
        value: 123,
        nested: { a: 1, b: 2 },
        array: [1, 2, 3],
      });
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(plaintext));
    });
  });

  describe("decrypt invalid input", () => {
    it("throws on invalid base64", () => {
      const encrypted = "not-valid-base64!!!";
      expect(() => decrypt(encrypted)).toThrow();
    });

    it("throws on truncated data (missing bytes)", () => {
      const iv = randomBytes(12);
      const authTag = randomBytes(16);
      const shortCiphertext = Buffer.alloc(5);
      const combined = Buffer.concat([iv, authTag, shortCiphertext]);
      const encrypted = combined.toString("base64");
      expect(() => decrypt(encrypted)).toThrow();
    });

    it("throws on tampered data (wrong auth tag)", () => {
      const iv = randomBytes(12);
      const wrongAuthTag = randomBytes(16);
      const key = randomBytes(32);
      const { createCipheriv } = require("node:crypto");
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([
        cipher.update("test plaintext"),
        cipher.final(),
      ]);
      const combined = Buffer.concat([iv, wrongAuthTag, ciphertext]);
      const encrypted = combined.toString("base64");

      generateKey();
      expect(() => decrypt(encrypted)).toThrow();
    });

    it("throws on decrypt with wrong key", () => {
      const plaintext = "secret data";
      generateKey();
      const encrypted = encrypt(plaintext);

      const wrongKeyDir = mkdtempSync(join(tmpdir(), "opendom-wrong-key-"));
      __setTestPaths(wrongKeyDir, join(wrongKeyDir, "secrets.json"));
      generateKey();

      expect(() => decrypt(encrypted)).toThrow();
      __clearTestPaths();
      rmSync(wrongKeyDir, { recursive: true, force: true });
    });
  });

  describe("key management", () => {
    it("generateKey creates file with mode 0600", () => {
      const key = generateKey();
      expect(key.length).toBe(32);

      const keyFile = join(testDir, "encryption.key");
      const stats = require("node:fs").statSync(keyFile);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it("loadKey creates new key if file missing", () => {
      const key1 = loadKey();
      expect(key1.length).toBe(32);

      const keyFile = join(testDir, "encryption.key");
      const key2 = loadKey();
      expect(key2.equals(key1)).toBe(true);
    });

    it("loadKey throws on invalid key size (not 32 bytes)", () => {
      const keyFile = join(testDir, "encryption.key");
      writeFileSync(keyFile, Buffer.alloc(16), { mode: 0o600 });
      expect(() => loadKey()).toThrow(
        "Invalid encryption key: expected 32 bytes",
      );
    });
  });
});

describe("SecretStorageAdapter", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "opendom-storage-test-"));
    __setTestPaths(testDir, join(testDir, "secrets.json"));
  });

  afterEach(() => {
    __clearTestPaths();
    rmSync(testDir, { recursive: true, force: true });
  });

  it("read non-existent account returns undefined", () => {
    const adapter = createEncryptedSecretStorage();
    const result = adapter.read("nonexistent");
    expect(result).toBeUndefined();
  });

  it("write then read returns original value", () => {
    const adapter = createEncryptedSecretStorage();
    const written = adapter.write("account1", "my-secret-value");
    expect(written).toBe(true);

    const read = adapter.read("account1");
    expect(read).toBe("my-secret-value");
  });

  it("remove deletes the entry", () => {
    const adapter = createEncryptedSecretStorage();
    adapter.write("account1", "secret");
    expect(adapter.read("account1")).toBe("secret");

    adapter.remove("account1");
    expect(adapter.read("account1")).toBeUndefined();
  });

  it("remove non-existent is no-op", () => {
    const adapter = createEncryptedSecretStorage();
    expect(() => adapter.remove("nonexistent")).not.toThrow();
    expect(adapter.read("nonexistent")).toBeUndefined();
  });

  it("overwrite existing value works", () => {
    const adapter = createEncryptedSecretStorage();
    adapter.write("account1", "first-value");
    expect(adapter.read("account1")).toBe("first-value");

    adapter.write("account1", "second-value");
    expect(adapter.read("account1")).toBe("second-value");
  });
});
