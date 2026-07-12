// Service worker minimal : uniquement les notifications push. Volontairement
// aucun handler `fetch`/cache (pas de mode hors-ligne) pour ne rien intercepter
// des routes existantes, notamment le téléchargement de quittance PDF
// (/api/receipts/[paymentId], servi avec Content-Disposition: attachment).

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { title, body, link } = payload;

  event.waitUntil(
    self.registration.showNotification(title || "MboaCoin", {
      body: body || undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { link: link || "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.postMessage({ type: "PUSH_NAVIGATE", link });
            return client.focus();
          }
        }
        return self.clients.openWindow(link);
      })
  );
});
