const CACHE_NAME = 'daehansa-workflow-v2';
const STATIC_ASSETS = [
    '/manifest.json',
    '/logo.png'
];

self.addEventListener('install', (event) => {
    // 즉시 활성화
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    // 이전 캐시 정리
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. 외부 요청, POST, Firebase Auth 관련 경로, Query Parameter가 있는 요청은 SW 건너뛰기
    // (Auth Redirect 시 URL 파라미터가 유실되면 안됨)
    if (
        event.request.method !== 'GET' ||
        url.origin !== self.location.origin ||
        url.pathname.startsWith('/__/') ||
        url.search !== ''
    ) {
        return;
    }

    // 2. index.html 및 루트 경로는 항상 Network First (최신 버전 보장)
    if (url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match('/index.html')) // 오프라인일 때만 캐시 사용
        );
        return;
    }

    // 3. Vite 빌드된 정적 자산(assets 폴더)은 Cache First (해시되므로 안전)
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                return cached || fetch(event.request).then((response) => {
                    // 유효한 응답만 캐싱
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // 4. 기타 정적 자산 (manifest, logo 등) - Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return networkResponse;
            });
            return cached || fetchPromise;
        })
    );
});
