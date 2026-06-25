// src/hooks/useRegisterServiceWorker.ts
// Enregistre le service worker en environnement web (PWA installable).
// No-op en natif. Ne fait rien en SSR (typiquement pas applicable en Expo,
// mais on garde une garde typeof window par sécurité).

import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useRegisterServiceWorker() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // Mise à jour silencieuse
        reg.update().catch(() => {});
        console.log('[PWA] Service Worker enregistré :', reg.scope);
      } catch (e) {
        console.warn('[PWA] Échec enregistrement Service Worker', e);
      }
    };

    // Laisse le temps au bundle de finir de charger
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);
}
