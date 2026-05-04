/*
  IndexedDB vault — supports two modes:

  1. 'encrypted' — legacy. nsec encrypted with a key derived from PRF(passkey, salt).
     Used by users who logged in with an existing nsec and then enrolled biometrics.

  2. 'derived' — new. Stores only the credential id. The nsec AND Liquid mnemonic
     are re-derived from PRF outputs on every unlock (zero ciphertext on disk).
     Used by the seedless "Start fresh" passkey wallet path.

  The `kind` field discriminates. Pre-existing blobs without a kind field are
  treated as 'encrypted' for backwards compat.
*/

const DB_NAME = 'zappr';
const DB_VERSION = 1;
const STORE = 'vault';
const KEY = 'session';

export type EncryptedVaultBlob = {
  kind: 'encrypted';
  credentialId: Uint8Array;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  salt: Uint8Array;
};

export type DerivedVaultBlob = {
  kind: 'derived';
  credentialId: Uint8Array;
};

export type VaultBlob = EncryptedVaultBlob | DerivedVaultBlob;

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
      req.onsuccess = () => {
        const raw = req.result as VaultBlob | undefined;
        if (!raw) return resolve(null);
        if (!('kind' in raw)) {
          resolve({ kind: 'encrypted', ...(raw as Omit<EncryptedVaultBlob, 'kind'>) });
        } else {
          resolve(raw);
        }
      };
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

export async function vaultKind(): Promise<'encrypted' | 'derived' | null> {
  const blob = await vaultGet();
  return blob?.kind ?? null;
}
