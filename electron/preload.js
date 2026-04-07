const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  browseFolder: (currentPath) => ipcRenderer.invoke("browse-folder", currentPath),
});
