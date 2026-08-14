/**
 * Pluggable storage for reference-video blobs recorded during movement
 * activity creation.
 *
 * Video files are too large to fit in LocalStorage (which is capped at a few
 * MB and only stores strings). This service abstracts away the underlying
 * storage so the app can use IndexedDB locally today and swap in a real
 * cloud/backend storage (S3, Cloud Storage, etc.) without changes to the
 * calling code.
 */

export interface VideoBlobStore {
  /** Persist a video blob and return a stable id that can be saved on the activity. */
  save(id: string, blob: Blob): Promise<void>;
  /** Fetch a previously saved blob (or null if it has been deleted). */
  get(id: string): Promise<Blob | null>;
  /** Delete a blob by id. */
  remove(id: string): Promise<void>;
  /**
   * Resolve a blob to a URL that <video> can play. For local storage this is
   * an object URL the caller is responsible for revoking; for cloud storage
   * this would be the remote URL from the backend.
   */
  resolveUrl(id: string): Promise<string | null>;
}

const DB_NAME = "gymparrot_video_blobs";
const STORE_NAME = "videos";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

/**
 * IndexedDB-backed implementation. Stores the raw Blob keyed by id and
 * returns object URLs that the caller can feed directly to a <video> element.
 */
export class IndexedDbVideoBlobStore implements VideoBlobStore {
  async save(id: string, blob: Blob): Promise<void> {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to save video blob"));
    });
    db.close();
  }

  async get(id: string): Promise<Blob | null> {
    const db = await openDatabase();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Failed to read video blob"));
    });
    db.close();
    return blob;
  }

  async remove(id: string): Promise<void> {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to delete video blob"));
    });
    db.close();
  }

  async resolveUrl(id: string): Promise<string | null> {
    const blob = await this.get(id);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }
}

/**
 * Placeholder for a cloud/backend implementation. Swap
 * {@link videoBlobStore} below to use it, or inject it in tests.
 *
 * Example implementation shape (not wired):
 *   async save(id, blob)      → PUT /api/videos/{id}  (multipart)
 *   async resolveUrl(id)      → returns the CDN URL the backend issued
 */
export class BackendVideoBlobStore implements VideoBlobStore {
  constructor(private readonly apiBaseUrl: string = "/api") {}

  async save(_id: string, _blob: Blob): Promise<void> {
    throw new Error(
      `Backend video storage is not implemented yet (apiBaseUrl=${this.apiBaseUrl}).`
    );
  }
  async get(_id: string): Promise<Blob | null> {
    throw new Error("Backend video storage is not implemented yet");
  }
  async remove(_id: string): Promise<void> {
    throw new Error("Backend video storage is not implemented yet");
  }
  async resolveUrl(_id: string): Promise<string | null> {
    throw new Error("Backend video storage is not implemented yet");
  }
}

// Export the active implementation. Swap this line to change backends:
//   export default new BackendVideoBlobStore("https://api.example.com");
const videoBlobStore: VideoBlobStore = new IndexedDbVideoBlobStore();
export default videoBlobStore;
