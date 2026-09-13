/* =========================================================
   薛朗的资源仓库 - Service Worker（PWA）
   策略：页面导航走「网络优先 + 缓存兜底」，静态资源走「缓存优先 + 后台更新」。
   仅缓存本站资源；外部请求（Supabase / CDN）一律不缓存。
   更新时自动接管（skipWaiting + clients.claim），保证新版本及时生效。
   ========================================================= */

'use strict';

const CACHE = 'xl-resource-hub-v1';
const CORE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './favicon.ico',
  './icons/icon-head.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

/* 安装：预缓存核心文件 */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return cache.addAll(CORE);
      })
      .then(function () {
        return self.skipWaiting();
      })
      .catch(function () {
        /* 个别文件缓存失败不阻塞安装，正常走网络 */
      })
  );
});

/* 激活：清理旧缓存并立即接管页面 */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

/* 请求拦截 */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }
  /* 只处理本站请求，外部请求（Supabase、CDN）不干预 */
  if (url.origin !== self.location.origin) return;

  /* 页面导航：网络优先，离线时回退缓存 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(req, copy);
            });
          }
          return res;
        })
        .catch(function () {
          return caches
            .match(req)
            .then(function (hit) {
              return hit || caches.match('./index.html');
            });
        })
    );
    return;
  }

  /* 静态资源：缓存优先 + 后台更新 */
  event.respondWith(
    caches.match(req).then(function (cached) {
      const network = fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(req, copy);
            });
          }
          return res;
        })
        .catch(function () {
          return cached;
        });
      return cached || network;
    })
  );
});
