const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  browseFolder: (currentPath) => ipcRenderer.invoke("browse-folder", currentPath),
  getVersion: () => ipcRenderer.invoke("get-version"),
  // NAVER WORKS SSO — main process가 BrowserWindow로 OAuth dance 진행 후
  // callback fragment의 raw token(base64url-json)을 resolve.
  ssoWorksLogin: (options) => ipcRenderer.invoke("sso-works-login", options || {}),
});
