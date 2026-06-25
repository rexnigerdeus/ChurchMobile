// src/lib/pwa-meta.ts
// Injecte dynamiquement les balises <meta> PWA dans le <head> quand l'app tourne en web.
// (Expo ne génère pas ces balises par défaut, on les ajoute côté client.)

import { Platform } from 'react-native';

interface Meta {
  name?: string;
  httpEquiv?: string;
  content: string;
}

interface Link {
  rel: string;
  href: string;
  sizes?: string;
  type?: string;
}

let injected = false;

function ensureMeta(m: Meta) {
  if (typeof document === 'undefined') return;
  const attr = m.name ? 'name' : 'http-equiv';
  const sel = m.name ? `meta[name="${m.name}"]` : `meta[http-equiv="${m.httpEquiv}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, m.name || m.httpEquiv || '');
    document.head.appendChild(el);
  }
  el.setAttribute('content', m.content);
}

function ensureLink(l: Link) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${l.rel}"][href="${l.href}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = l.rel;
    el.href = l.href;
    if (l.sizes) el.sizes = l.sizes;
    if (l.type) el.type = l.type;
    document.head.appendChild(el);
  }
}

export function injectPwaMeta() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (injected) return;
  injected = true;

  // Manifest
  ensureLink({ rel: 'manifest', href: '/manifest.json' });

  // Theme
  ensureMeta({ name: 'theme-color', content: '#0f172a' });
  ensureMeta({ name: 'apple-mobile-web-app-capable', content: 'yes' });
  ensureMeta({ name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
  ensureMeta({ name: 'apple-mobile-web-app-title', content: 'Mon Église' });
  ensureMeta({ name: 'mobile-web-app-capable', content: 'yes' });
  ensureMeta({ name: 'application-name', content: 'Mon Église' });
  ensureMeta({ name: 'description', content: 'Application de gestion d\'église : annonces, prières, rendez-vous, départements.' });
  ensureMeta({ httpEquiv: 'X-UA-Compatible', content: 'IE=edge' });

  // Apple touch icons
  ensureLink({ rel: 'apple-touch-icon', href: '/assets/icon.png', sizes: '180x180' });
  ensureLink({ rel: 'icon', href: '/assets/favicon.png', sizes: '32x32', type: 'image/png' });
  ensureLink({ rel: 'icon', href: '/assets/icon.png', sizes: '192x192', type: 'image/png' });
  ensureLink({ rel: 'icon', href: '/assets/icon.png', sizes: '512x512', type: 'image/png' });
}
