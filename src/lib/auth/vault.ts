/*
  IndexedDB vault for the encrypted nsec blob.

  Holds the WebAuthn credential id (so we can call get() with allowCredentials),
  the AES-GCM iv, the PRF salt, and the ciphertext. The actual encryption /
  decryption lives in webauthn.ts + crypto.ts — this file is just storage.
*/

const DB_NAME = 'zappr';
const DB_VERSION = 1;
const STORE = 'vault';
const KEY = 'session';

export type VaultBlob = {
  credentialId: Uint8Array;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  salt: Uint8Array;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function vaultGet(): Promise<VaultBlob | null> {
  try {
    const db = await openDb();
    return await new Promise<VaultBlob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as VaultBlob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function vaultPut(blob: VaultBlob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function vaultClear(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function vaultExists(): Promise<boolean> {
  const blob = await vaultGet();
  return !!blob;
}
