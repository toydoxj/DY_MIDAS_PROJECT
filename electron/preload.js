const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  browseFolder: (currentPath) => ipcRenderer.invoke("browse-folder", currentPath),
  getVersion: () => ipcRenderer.invoke("get-version"),
  // NAVER WORKS SSO — main process가 BrowserWindow로 OAuth dance 진행 후
  // callback fragment의 raw token(base64url-json)을 resolve.
  // options.silent=true → hidden window 로 silent SSO 시도 (NAVER 세션 살아있을 때만 성공).
  ssoWorksLogin: (options) => ipcRenderer.invoke("sso-works-login", options || {}),
  // OS 보호 영역(safeStorage)에 JWT 토큰 + 사용자 정보 영속 저장.
  // localStorage 평문 노출을 막고 dev tools / 디스크 직접 접근 시 토큰 추출 불가.
  // safeStorage 미지원 환경이면 load.available=false → frontend 가 메모리 세션만 사용.
  auth: {
    load: () => ipcRenderer.invoke("auth-load"),
    save: (payload) => ipcRenderer.invoke("auth-save", payload),
    clear: () => ipcRenderer.invoke("auth-clear"),
  },
});
