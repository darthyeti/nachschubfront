// Registers the service worker and reports when a new build is waiting.
//
// The worker never takes over on its own (see sw.js): it installs in the
// background and stays in the wings until the player presses the button in the
// menu. That way an update can never reload a running match.

const WORKER = 'sw.js';

/**
 * @param {(ready: boolean) => void} onUpdate  Called with true once a new build
 *   is installed and waiting. Never called for the very first install, where
 *   there is nothing to update from.
 * @returns {{apply: () => void}}  `apply` lets the waiting worker take over and
 *   reloads the page.
 */
export function registerServiceWorker(onUpdate = () => {}) {
  /** @type {ServiceWorkerRegistration|null} */
  let registration = null;
  let announced = false;
  let reloading = false;
  let listening = false;

  /**
   * The reload happens on controllerchange, not in `apply`: the new worker has
   * to be in charge before the page asks for files again, or the reload would
   * still come out of the old cache.
   */
  function reloadWhenInCharge() {
    if (listening) return;
    listening = true;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  /**
   * Tells a worker to stop waiting. One that is still installing cannot act on
   * that message — it would be dropped and the button would do nothing — so it
   * is asked again the moment it is installed.
   */
  function skipWaiting(worker) {
    if (!worker) return;
    if (worker.state === 'installing') {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') worker.postMessage({ type: 'skipWaiting' });
      });
      return;
    }
    worker.postMessage({ type: 'skipWaiting' });
  }

  function apply() {
    if (!registration) return;
    reloadWhenInCharge();
    // Which worker is the new build changes while it installs, so it is looked
    // up now rather than kept from the moment the notice went up.
    skipWaiting(registration.waiting ?? registration.installing);
  }

  // file:// has no service workers, and neither has a browser that lacks them.
  // The game has to run in both cases, so this is a quiet no-op there.
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return { apply };

  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register(WORKER);
    } catch {
      // No offline support this time; the game itself is unaffected.
      return;
    }

    const announce = (worker) => {
      // Without a controller this is the first install: nothing to replace.
      if (!worker || !navigator.serviceWorker.controller || announced) return;
      announced = true;
      onUpdate(true);
    };

    announce(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') announce(registration.waiting ?? installing);
      });
    });
  });

  return { apply };
}
