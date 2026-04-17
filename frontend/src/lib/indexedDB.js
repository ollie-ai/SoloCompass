const DB_NAME = 'solocompass_offline';
const DB_VERSION = 1;
const STORE_MUTATIONS = 'offline_mutations';

let db = null;

function openDB() {
  if (db) return Promise.resolve(db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_MUTATIONS)) {
        const store = database.createObjectStore(STORE_MUTATIONS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status');
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

export const offlineMutationQueue = {
  async enqueue(mutation) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORE_MUTATIONS);
      const item = {
        ...mutation,
        status: 'pending',
        attempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const request = store.add(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getPending() {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_MUTATIONS, 'readonly');
      const store = tx.objectStore(STORE_MUTATIONS);
      const index = store.index('status');
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async markProcessed(id) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORE_MUTATIONS);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) return resolve();
        item.status = 'delivered';
        item.updatedAt = new Date().toISOString();
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async markFailed(id, error) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORE_MUTATIONS);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) return resolve();
        item.attempts = (item.attempts || 0) + 1;
        item.lastError = error;
        item.status = item.attempts >= 3 ? 'failed' : 'pending';
        item.updatedAt = new Date().toISOString();
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },

  async processPending(executeFunc) {
    const pending = await this.getPending();
    for (const mutation of pending) {
      try {
        await executeFunc(mutation);
        await this.markProcessed(mutation.id);
      } catch (err) {
        await this.markFailed(mutation.id, err.message);
      }
    }
    return pending.length;
  },

  async count() {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_MUTATIONS, 'readonly');
      const store = tx.objectStore(STORE_MUTATIONS);
      const index = store.index('status');
      const request = index.count('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
};

export default offlineMutationQueue;
