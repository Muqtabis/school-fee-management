// Registers the offline service worker in production builds only,
// so `npm start` development sessions never serve cached stale code.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/sw.js`)
      .catch(() => {
        // Offline support is a bonus — never block the app on registration.
      });
  });
}
