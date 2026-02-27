/**
 * Offline Sync Engine with connection pooling
 *
 * Queues mutations (votes, comments, proposals) in IndexedDB when offline,
 * then replays them in order when connectivity returns.
 * Conflict resolution uses last-write-wins with server timestamp comparison.
 *
 * Connection pooling: single cached IDBDatabase instance with 5-second TTL
 * to avoid N+1 open/close overhead during bulk operations.
 */

export interface QueuedAction {
  id: string;
  type: "vote" | "comment" | "proposal";
  method: "POST" | "PUT" | "DELETE";
  url: string;
  body: string;
  timestamp: number;
  retries: number;
}

export interface SyncResult {
  id: string;
  success: boolean;
  status?: number;
  error?: string;
  conflict?: boolean;
}

const DB_NAME = "ideate-offline";
const DB_VERSION = 1;
const STORE_NAME = "sync-queue";
const MAX_RETRIES = 3;
const MAX_QUEUE_SIZE = 100;
const DB_CLOSE_TIMEOUT = 5000;

// Connection pool — reuse a single IDBDatabase across calls
let cachedDb: IDBDatabase | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function resetCloseTimer() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (cachedDb) {
      cachedDb.close();
      cachedDb = null;
    }
  }, DB_CLOSE_TIMEOUT);
}

function getDB(): Promise<IDBDatabase> {
  if (cachedDb) {
    resetCloseTimer();
    return Promise.resolve(cachedDb);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => {
      cachedDb = request.result;
      cachedDb.onclose = () => { cachedDb = null; };
      resetCloseTimer();
      resolve(cachedDb);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function enqueueAction(
  action: Omit<QueuedAction, "id" | "timestamp" | "retries">,
): Promise<string> {
  const db = await getDB();
  const id = `${action.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: QueuedAction = { ...action, id, timestamp: Date.now(), retries: 0 };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueueActionSafe(
  action: Omit<QueuedAction, "id" | "timestamp" | "retries">,
): Promise<string> {
  const currentSize = await getQueueSize();

  if (currentSize >= MAX_QUEUE_SIZE) {
    const toRemove = Math.ceil(MAX_QUEUE_SIZE * 0.2);
    const oldest = await getOldestActions(toRemove);
    for (const old of oldest) {
      await removeAction(old.id);
    }
  }

  return enqueueAction(action);
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("timestamp");
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeAction(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateActionRetries(id: string, retries: number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, retries });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearQueue(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueueSize(): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getOldestActions(count: number): Promise<QueuedAction[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("timestamp");
    const request = index.getAll();
    request.onsuccess = () => {
      resolve(request.result.slice(0, count));
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Replay a single queued action. Returns sync result.
 * 409 is treated as a conflict (server has newer data).
 */
export async function replayAction(action: QueuedAction): Promise<SyncResult> {
  try {
    const res = await fetch(action.url, {
      method: action.method,
      headers: { "Content-Type": "application/json" },
      body: action.method !== "DELETE" ? action.body : undefined,
      credentials: "include",
    });

    if (res.ok) {
      await removeAction(action.id);
      return { id: action.id, success: true, status: res.status };
    }

    if (res.status === 409) {
      await removeAction(action.id);
      return { id: action.id, success: false, status: 409, conflict: true };
    }

    if (action.retries + 1 >= MAX_RETRIES) {
      await removeAction(action.id);
      return { id: action.id, success: false, status: res.status, error: `Max retries reached (${res.status})` };
    }

    await updateActionRetries(action.id, action.retries + 1);
    return { id: action.id, success: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    if (action.retries + 1 >= MAX_RETRIES) {
      await removeAction(action.id);
      return { id: action.id, success: false, error: `Network error after ${MAX_RETRIES} retries` };
    }
    await updateActionRetries(action.id, action.retries + 1);
    return { id: action.id, success: false, error: "Network error" };
  }
}

/**
 * Replay all queued actions in timestamp order.
 * Uses pooled connection for efficiency.
 */
export async function replayAll(): Promise<SyncResult[]> {
  const actions = await getQueuedActions();
  if (actions.length === 0) return [];

  const results: SyncResult[] = [];
  for (const action of actions) {
    results.push(await replayAction(action));
  }
  return results;
}
