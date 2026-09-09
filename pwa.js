(function setupOfflineSupport() {
  "use strict";

  // Installation is handled by the browser through the web app manifest.
  // Do not intercept or cancel beforeinstallprompt.
  const installStatus = document.getElementById("installStatus");
  const validProtocol = location.protocol === "https:" || location.protocol === "http:";
  const canRegister = validProtocol && window.isSecureContext && "serviceWorker" in navigator;
  let offlineReady = false;
  let offlineFailed = false;
  let updateWaiting = false;

  function renderOfflineState() {
    if (!installStatus) return;

    if (!canRegister) {
      installStatus.textContent = location.protocol === "file:"
        ? "Modo arquivo local"
        : "Uso pelo navegador";
    } else if (updateWaiting) {
      installStatus.textContent = "Atualização pronta · reabra o aplicativo";
    } else if (offlineReady) {
      installStatus.textContent = navigator.onLine ? "Disponível offline" : "Usando offline";
    } else if (offlineFailed) {
      installStatus.textContent = "Offline indisponível neste acesso";
    } else {
      installStatus.textContent = "Preparando acesso offline…";
    }
  }

  window.addEventListener("online", renderOfflineState);
  window.addEventListener("offline", renderOfflineState);

  function confirmOfflineCache(worker) {
    if (!worker || typeof MessageChannel === "undefined") return;
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      offlineFailed = true;
      renderOfflineState();
    }, 10000);
    channel.port1.onmessage = event => {
      if (event.data?.type !== "OFFLINE_STATUS") return;
      window.clearTimeout(timeout);
      channel.port1.close();
      offlineReady = event.data.ready === true;
      offlineFailed = !offlineReady;
      renderOfflineState();
    };
    worker.postMessage({ type: "CHECK_OFFLINE_READY" }, [channel.port2]);
  }

  async function registerOfflineSupport() {
    try {
      // An update check may wait for the network. Verify an existing offline copy first.
      let previous = await navigator.serviceWorker.getRegistration("./");
      if (previous?.scope !== new URL("./", location.href).href) previous = null;
      if (previous?.active) confirmOfflineCache(previous.active);
      let registration;
      try {
        registration = await navigator.serviceWorker.register("./sw.js", {
          scope: "./",
          updateViaCache: "none"
        });
      } catch (error) {
        if (!previous?.active) throw error;
        registration = previous;
      }
      updateWaiting = Boolean(registration.waiting && navigator.serviceWorker.controller);
      const observedWorkers = new WeakSet();
      function watchInstallingWorker() {
        const worker = registration.installing;
        if (!worker || observedWorkers.has(worker)) return;
        observedWorkers.add(worker);
        const updateWorkerState = () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) updateWaiting = true;
          if (worker.state === "redundant" && !offlineReady) offlineFailed = true;
          renderOfflineState();
        };
        worker.addEventListener("statechange", updateWorkerState);
        updateWorkerState();
      }
      registration.addEventListener("updatefound", watchInstallingWorker);
      watchInstallingWorker();
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        confirmOfflineCache(navigator.serviceWorker.controller);
      });
      renderOfflineState();
      const readyRegistration = await navigator.serviceWorker.ready;
      confirmOfflineCache(readyRegistration.active);
    } catch {
      offlineFailed = true;
      renderOfflineState();
    }
  }

  renderOfflineState();
  if (canRegister) registerOfflineSupport();
})();




