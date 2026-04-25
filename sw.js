// Service worker временно отключён (на время тестирования).
// Эта версия сама себя выгружает и чистит все кэши, которые
// оставил предыдущий service worker — чтобы у пользователей,
// которые уже заходили на сайт раньше, автоматически подтянулся
// свежий контент, а не старая кэшированная версия.

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Удаляем все кэши этого домена
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));

    // Выгружаем сам service worker
    await self.registration.unregister();

    // Перезагружаем открытые вкладки, чтобы они подхватили новую версию
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      try { client.navigate(client.url); } catch (_) {}
    }
  })());
});
