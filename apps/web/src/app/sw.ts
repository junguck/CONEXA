import { defaultCache } from '@serwist/next/worker';
import { Serwist, type PrecacheEntry } from 'serwist';

// Déclaré dans le module : le service worker n'a pas le type global `Window`.
declare const self: WorkerScope & typeof globalThis;

interface WorkerScope {
  __SW_MANIFEST?: (PrecacheEntry | string)[];
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  skipWaiting(): Promise<void>;
}

const worker = self as unknown as WorkerScope;
// Serwist remplace cette expression par la liste des fichiers précachés au build.
const precacheEntries = self.__SW_MANIFEST;

const serwist = new Serwist({
  precacheEntries,
  // L'utilisateur décide quand recharger : l'invite de mise à jour envoie
  // SKIP_WAITING (voir src/shell/pwa/update-prompt.tsx).
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

worker.addEventListener('message', (event: MessageEvent) => {
  if (event.data && (event.data as { type?: string }).type === 'SKIP_WAITING') {
    void worker.skipWaiting();
  }
});

serwist.addEventListeners();
