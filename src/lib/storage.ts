// src/lib/storage.ts
// Adaptateur de stockage cross-platform (web + natif).
// Sur web → localStorage. Sur mobile → AsyncStorage (via require dynamique pour éviter l'erreur au build web).

import { Platform } from 'react-native';

let nativeStorage: any = null;

if (Platform.OS !== 'web') {
  // Import dynamique : ne s'exécute QUE sur natif. Sur web, on évite le require
  // (l'import d'AsyncStorage sur web casse avec certains bundlers et la version 2.x a une dépendance react-native).
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeStorage = require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    console.warn('[storage] AsyncStorage non disponible, fallback web storage.', e);
  }
}

const memoryStore: Record<string, string> = {};
const isWeb = Platform.OS === 'web';

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        return typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(key)
          : memoryStore[key] ?? null;
      } catch {
        return memoryStore[key] ?? null;
      }
    }
    if (nativeStorage) return await nativeStorage.getItem(key);
    return memoryStore[key] ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
      } catch {
        // quota / privacy mode → bascule mémoire
      }
      memoryStore[key] = value;
      return;
    }
    if (nativeStorage) return await nativeStorage.setItem(key, value);
    memoryStore[key] = value;
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
          return;
        }
      } catch {
        // ignore
      }
      delete memoryStore[key];
      return;
    }
    if (nativeStorage) return await nativeStorage.removeItem(key);
    delete memoryStore[key];
  },
};

export default storage;
