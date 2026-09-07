const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  saveProductionPdf: summary => ipcRenderer.invoke("save-production-pdf", summary)
});
