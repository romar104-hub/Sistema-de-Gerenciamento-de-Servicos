/* Service Worker - Criatório Marques
   Estratégia: rede primeiro (sempre pega a versão mais nova quando há sinal)
   e, se a rede falhar ou demorar, usa a cópia guardada no aparelho. */

const VERSAO_CACHE = 'criatorio-marques-v2'; // mude o número ao publicar mudanças grandes
const TEMPO_LIMITE_REDE_MS = 4000;

const ARQUIVOS_BASE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSAO_CACHE).then(cache =>
      // adiciona um por um: se algum arquivo (ex.: logo.png) não existir, os demais continuam
      Promise.all(ARQUIVOS_BASE.map(url => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO_CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function redeComLimite(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), TEMPO_LIMITE_REDE_MS);
    fetch(request).then(resp => {
      clearTimeout(timer);
      resolve(resp);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Só controla arquivos do próprio site. O clima (open-meteo) segue direto pela rede.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    redeComLimite(request)
      .then(resposta => {
        if (resposta && resposta.ok) {
          const copia = resposta.clone();
          caches.open(VERSAO_CACHE).then(cache => cache.put(request, copia));
        }
        return resposta;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then(emCache => {
          if (emCache) return emCache;
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
