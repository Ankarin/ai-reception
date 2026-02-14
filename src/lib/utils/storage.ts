interface StorageData<T> {
  version: number;
  timestamp: number;
  data: T;
}

const STORAGE_VERSION = 1;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function getFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const parsed = JSON.parse(item) as StorageData<T>;

    if (!parsed || typeof parsed !== "object") {
      localStorage.removeItem(key);
      return null;
    }

    if (parsed.version !== STORAGE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }

    if (Date.now() - parsed.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error(`Failed to parse storage key "${key}":`, error);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Failed to remove corrupted storage key:", e);
    }
    return null;
  }
}

export function setToStorage<T>(key: string, data: T): boolean {
  if (typeof window === "undefined") return false;

  try {
    const storageData: StorageData<T> = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(key, JSON.stringify(storageData));
    return true;
  } catch (error) {
    console.error(`Failed to save to storage key "${key}":`, error);
    return false;
  }
}

export function removeFromStorage(key: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove storage key "${key}":`, error);
  }
}

export function clearOrgStorage(orgId: string): void {
  if (typeof window === "undefined") return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes(`-${orgId}-`) || key?.includes(`-${orgId}`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error("Failed to clear org storage:", error);
  }
}
