(function setupInstallableApp() {
  "use strict";

  const installButton = document.getElementById("btnInstallApp");
  const installLabel = installButton?.querySelector("[data-install-label]") || installButton;
  const installStatus = document.getElementById("installStatus");
  const helpDialog = document.getElementById("installHelpDialog");
  const helpText = document.getElementById("installHelpText");
  const closeHelpButton = document.getElementById("btnCloseInstallHelp");
  const standaloneDisplay = window.matchMedia("(display-mode: standalone)");
  const validProtocol = location.protocol === "https:" || location.protocol === "http:";
  const canRegister = validProtocol && window.isSecureContext && "serviceWorker" in navigator;

  let pendingInstall = null;
  let installedThisSession = false;
  let offlineReady = false;
  let offlineFailed = false;
  let updateWaiting = false;
  let prompting = false;

  const isInstalled = () => installedThisSession || standaloneDisplay.matches || navigator.standalone === true;

  function renderInstallState() {
    if (installButton) {
      installButton.disabled = isInstalled() || prompting;
      installButton.dataset.installState = isInstalled() ? "installed" : pendingInstall ? "available" : "help";
      installButton.setAttribute("aria-haspopup", pendingInstall ? "true" : "dialog");
    }
    if (installLabel) installLabel.textContent = isInstalled() ? "App instalado" : "Instalar aplicativo";
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

  function installationHelp() {
    if (location.protocol === "file:") {
      return "O aplicativo funciona abrindo este arquivo, mas a instalação pelo navegador exige um endereço local ou HTTPS. Para instalar neste computador, execute Iniciar-Producao.cmd na pasta do projeto e abra o endereço local indicado usando Chrome ou Edge. O iniciador precisa do Node.js. Depois, use Instalar aplicativo. Seus relatórios continuam sendo processados no computador.";
    }
    if (!validProtocol || !window.isSecureContext) {
      return "Abra este aplicativo por HTTPS ou pelo endereço local indicado ao executar Iniciar-Producao.cmd. Um endereço HTTP de rede não habilita os recursos necessários para instalação e uso offline.";
    }
    if (!canRegister) {
      return "Este navegador não disponibilizou o recurso de uso offline. Para instalar no computador, abra o mesmo endereço no Chrome ou Edge, em uma janela normal. Você pode continuar usando a versão no navegador.";
    }
    const offlineNote = offlineReady
      ? "O aplicativo já está disponível offline. Ao reabrir, selecione novamente o arquivo do relatório."
      : "Aguarde a indicação Disponível offline antes de depender do acesso sem conexão.";
    return "No Chrome ou Edge, procure o ícone de instalação na barra de endereço. Você também pode procurar Instalar esta página como um app no menu do Chrome ou Aplicativos no menu do Edge. A opção pode não aparecer se o app já estiver instalado, em navegação privada ou se houver restrições do navegador. " + offlineNote;
  }

  function showHelp() {
    const message = installationHelp();
    if (helpText) helpText.textContent = message;
    if (helpDialog && typeof helpDialog.showModal === "function") {
      if (!helpDialog.open) helpDialog.showModal();
    } else if (installStatus) {
      installStatus.textContent = message;
    }
  }

  closeHelpButton?.addEventListener("click", () => helpDialog?.close());
  helpDialog?.addEventListener("click", event => {
    if (event.target !== helpDialog) return;
    const box = helpDialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) {
      helpDialog.close();
    }
  });

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    pendingInstall = event;
    renderInstallState();
  });

  window.addEventListener("appinstalled", () => {
    installedThisSession = true;
    pendingInstall = null;
    renderInstallState();
    if (helpDialog?.open) helpDialog.close();
  });

  installButton?.addEventListener("click", async () => {
    if (prompting || isInstalled()) return;
    if (!pendingInstall) {
      showHelp();
      return;
    }

    const installPrompt = pendingInstall;
    pendingInstall = null;
    prompting = true;
    renderInstallState();
    try {
      // The browser's native confirmation is opened only by this user click.
      await installPrompt.prompt();
      await installPrompt.userChoice;
      // Only appinstalled/standalone confirms completion, not an accepted prompt.
    } catch {
      showHelp();
    } finally {
      prompting = false;
      renderInstallState();
    }
  });

  standaloneDisplay.addEventListener?.("change", renderInstallState);
  window.addEventListener("online", renderInstallState);
  window.addEventListener("offline", renderInstallState);

  function confirmOfflineCache(worker) {
    if (!worker || typeof MessageChannel === "undefined") return;
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      offlineFailed = true;
      renderInstallState();
    }, 10000);
    channel.port1.onmessage = event => {
      if (event.data?.type !== "OFFLINE_STATUS") return;
      window.clearTimeout(timeout);
      channel.port1.close();
      offlineReady = event.data.ready === true;
      offlineFailed = !offlineReady;
      renderInstallState();
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
          renderInstallState();
        };
        worker.addEventListener("statechange", updateWorkerState);
        updateWorkerState();
      }
      registration.addEventListener("updatefound", watchInstallingWorker);
      watchInstallingWorker();
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        confirmOfflineCache(navigator.serviceWorker.controller);
      });
      renderInstallState();
      const readyRegistration = await navigator.serviceWorker.ready;
      confirmOfflineCache(readyRegistration.active);
    } catch {
      offlineFailed = true;
      renderInstallState();
    }
  }

  renderInstallState();
  if (canRegister) registerOfflineSupport();
})();




