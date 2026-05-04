const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const net = require("net");
const http = require("http");
const kill = require("tree-kill");

let mainWindow;
let backendProcess;
let backendPort = 0;
let backendExitInfo = null;

// OS에서 사용 가능한 빈 포트 확보
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// 백엔드 로그 파일 경로 (사용자 진단용)
function getBackendLogPath() {
  const logDir = app.getPath("userData");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  return path.join(logDir, "backend.log");
}

// 백엔드 서버가 응답할 때까지 대기 (기본 180초)
function waitForBackend(port, maxRetries = 360) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      if (backendExitInfo) {
        reject(new Error(`백엔드 프로세스가 예기치 않게 종료되었습니다 (exit code ${backendExitInfo.code}).`));
        return;
      }
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (++retries >= maxRetries) {
        reject(new Error("백엔드 서버 시작 시간 초과 (180초)"));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

// 백엔드 프로세스 시작
async function startBackend() {
  backendPort = await getFreePort();

  const backendExe = app.isPackaged
    ? path.join(process.resourcesPath, "backend", "backend.exe")
    : path.join(__dirname, "..", "backend", "dist", "backend", "backend.exe");

  // cwd를 프로젝트 루트(또는 exe 디렉토리)로 설정하여 .env를 찾을 수 있게 함
  const backendCwd = app.isPackaged
    ? path.dirname(backendExe)
    : path.join(__dirname, "..");

  // 로그 파일 초기화 (파일 잠금 예외 무시)
  const logPath = getBackendLogPath();
  let logStream = null;
  try {
    logStream = fs.createWriteStream(logPath, { flags: "w" });
    logStream.write(`[launcher] backend.exe=${backendExe}\n`);
    logStream.write(`[launcher] cwd=${backendCwd}\n`);
    logStream.write(`[launcher] BACKEND_PORT=${backendPort}\n\n`);
  } catch (_) {}

  // 자체 access log 등 sidecar 데이터 — packaged resources는 read-only일 수 있으므로
  // 항상 OS user data 디렉토리에 둔다.
  const backendDataDir = app.getPath("userData");
  try { fs.mkdirSync(backendDataDir, { recursive: true }); } catch (_) {}

  backendExitInfo = null;
  backendProcess = spawn(backendExe, [], {
    env: {
      ...process.env,
      BACKEND_PORT: String(backendPort),
      BACKEND_DATA_DIR: backendDataDir,
      PYTHONIOENCODING: "utf-8",
    },
    cwd: backendCwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    const text = `[backend] ${data}`;
    console.log(text);
    if (logStream) logStream.write(data);
  });
  backendProcess.stderr.on("data", (data) => {
    const text = `[backend:err] ${data}`;
    console.error(text);
    if (logStream) logStream.write(data);
  });
  backendProcess.on("exit", (code, signal) => {
    backendExitInfo = { code, signal };
    console.log(`Backend exited with code ${code}`);
    if (logStream) {
      logStream.write(`\n[launcher] backend exited code=${code} signal=${signal}\n`);
      logStream.end();
    }
    backendProcess = null;
  });

  await waitForBackend(backendPort);
}

// 백엔드 프로세스 종료
function stopBackend() {
  if (backendProcess && backendProcess.pid) {
    kill(backendProcess.pid);
    backendProcess = null;
  }
}

// 메인 윈도우 생성
async function createWindow() {
  try {
    await startBackend();
  } catch (err) {
    const logPath = getBackendLogPath();
    dialog.showErrorBox(
      "MIDAS Dashboard 오류",
      `${err.message}\n\n진단 로그: ${logPath}\n이 파일을 개발자에게 전달해주세요.`
    );
    app.quit();
    return;
  }

  // 이전 빌드 캐시 제거 후 로드
  const { session } = require("electron");
  await session.defaultSession.clearCache();

  const appVersion = app.getVersion();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: `MIDAS Dashboard v${appVersion}`,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${backendPort}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// 자동 업데이트
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.logger = console;

  let progressWin = null;

  // GitHub API 가 release notes 를 HTML 로 주는데 dialog.showMessageBox 는
  // plain text 만 렌더하므로 태그/마크다운 기호 제거 + 엔티티 디코딩.
  const stripMarkup = (text) => {
    if (!text) return "";
    return String(text)
      // HTML 블록 요소를 줄바꿈으로 (가독성 보존)
      .replace(/<\/?(h[1-6]|p|div|li|br|hr|tr)[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      // 나머지 모든 HTML 태그 제거
      .replace(/<[^>]+>/g, "")
      // markdown 기호 제거
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      // HTML 엔티티
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // 빈 줄 압축 + 트림
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  // 너무 긴 노트는 dialog 가 거대해지므로 일부만
  const truncate = (text, maxLines = 25, maxChars = 1500) => {
    const lines = text.split("\n").slice(0, maxLines);
    let out = lines.join("\n");
    if (out.length > maxChars) out = out.slice(0, maxChars) + "…";
    if (text.split("\n").length > maxLines || text.length > maxChars) {
      out += "\n\n(전체 변경사항은 GitHub Release 페이지에서 확인)";
    }
    return out;
  };

  autoUpdater.on("update-available", (info) => {
    const raw = typeof info.releaseNotes === "string"
      ? info.releaseNotes
      : Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map((n) => n.note || n).join("\n")
        : "";
    const releaseNotes = truncate(stripMarkup(raw));

    const message = `새 버전 v${info.version}이 있습니다.\n\n${releaseNotes ? "변경사항:\n" + releaseNotes + "\n\n" : ""}다운로드하시겠습니까?`;

    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "업데이트 알림",
        message,
        buttons: ["다운로드", "나중에"],
      })
      .then(({ response }) => {
        if (response === 0) {
          // 진행률 창 생성
          progressWin = new BrowserWindow({
            width: 400, height: 160,
            parent: mainWindow, modal: true,
            resizable: false, minimizable: false,
            title: "업데이트 다운로드 중",
            webPreferences: { contextIsolation: true },
          });
          progressWin.setMenuBarVisibility(false);
          progressWin.loadURL(`data:text/html;charset=utf-8,
            <html><body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:%231a1a2e;color:white">
              <p id="msg" style="font-size:14px;margin-bottom:12px">다운로드 준비 중...</p>
              <div style="width:80%;height:20px;background:%23333;border-radius:10px;overflow:hidden">
                <div id="bar" style="width:0%;height:100%;background:%23669900;transition:width 0.3s"></div>
              </div>
              <p id="pct" style="font-size:12px;color:%23aaa;margin-top:8px">0%</p>
            </body></html>
          `);
          autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on("download-progress", (progress) => {
    if (progressWin && !progressWin.isDestroyed()) {
      const pct = Math.round(progress.percent);
      const speed = (progress.bytesPerSecond / 1024 / 1024).toFixed(1);
      progressWin.webContents.executeJavaScript(`
        document.getElementById('bar').style.width='${pct}%';
        document.getElementById('pct').textContent='${pct}% (${speed} MB/s)';
        document.getElementById('msg').textContent='다운로드 중...';
      `).catch(() => {});
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    if (progressWin && !progressWin.isDestroyed()) {
      progressWin.close();
      progressWin = null;
    }

    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "업데이트 준비 완료",
        message: `v${info.version} 업데이트가 다운로드되었습니다.\n재시작하여 설치하시겠습니까?`,
        buttons: ["재시작", "나중에"],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

// 버전 정보 IPC 핸들러
ipcMain.handle("get-version", () => app.getVersion());

// 폴더 선택 IPC 핸들러
ipcMain.handle("browse-folder", async (_event, currentPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "작업 폴더 선택",
    defaultPath: currentPath || undefined,
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// NAVER WORKS SSO — task 백엔드(api.dyce.kr)가 처리하는 OAuth dance를
// 임베디드 BrowserWindow로 진행하고 callback fragment의 token을 가로챈다.
//
// 흐름:
//   ssoWin.loadURL(api.dyce.kr/api/auth/works/login?front=...&next=...)
//     → 302 NAVER WORKS authorize → 사용자 인증
//     → NAVER → api.dyce.kr/api/auth/works/callback
//     → api.dyce.kr가 https://<front>/auth/works/callback#token=<base64url-json> 으로 302
//     → BrowserWindow 페이지가 실제로 로드되기 전에 will-redirect/will-navigate 등에서
//       URL을 가로채 token 추출 후 윈도우 close.
//
// Electron BrowserWindow가 `/auth/works/callback#token=...` URL 패턴을 가로채므로
// redirect 대상 도메인은 무관 — task 백엔드가 default(task.dyce.kr)로 보내도 OK.
// 따라서 `front` query는 명시될 때만 전송 — Task_DY 가이드 §2.2 미적용 환경과도 호환.
ipcMain.handle("sso-works-login", async (_event, options = {}) => {
  const authBase = (process.env.AUTH_API_URL || "https://api.dyce.kr").replace(/\/+$/, "");
  const explicitFront = options.front || process.env.SSO_FRONT_ORIGIN || "";
  const next = options.next || "/";
  // task 백엔드의 (user_id, client) 단위 세션 분리 키.
  // 'dy-midas' 로 보내야 task.dyce.kr 와 동시에 활성 세션을 유지할 수 있다.
  const client = options.client || "dy-midas";
  const params = new URLSearchParams({ next, client });
  if (explicitFront) params.set("front", explicitFront);
  const startUrl = `${authBase}/api/auth/works/login?${params.toString()}`;
  const isDev = !app.isPackaged;
  const log = (...args) => console.log("[sso]", ...args);
  log("start", { startUrl, isDev });

  return new Promise((resolve, reject) => {
    let settled = false;
    const parentAlive = mainWindow && !mainWindow.isDestroyed();
    const ssoWin = new BrowserWindow({
      // mainWindow가 살아있을 때만 parent 지정. parent가 없으면 modal 동작 X.
      ...(parentAlive ? { parent: mainWindow, modal: true } : {}),
      width: 480,
      height: 720,
      show: true,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      backgroundColor: "#1a1a2e",
      title: "NAVER WORKS 로그인",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    ssoWin.setMenuBarVisibility(false);
    ssoWin.center();
    ssoWin.focus();
    if (isDev) {
      try { ssoWin.webContents.openDevTools({ mode: "detach" }); } catch (_) {}
    }

    const finishOk = (token) => {
      if (settled) return;
      settled = true;
      try { if (!ssoWin.isDestroyed()) ssoWin.close(); } catch (_) {}
      resolve(token);
    };
    const finishErr = (err) => {
      if (settled) return;
      settled = true;
      try { if (!ssoWin.isDestroyed()) ssoWin.close(); } catch (_) {}
      reject(err);
    };

    const tryConsume = (rawUrl, ev) => {
      if (!rawUrl || settled) return false;
      log("nav", rawUrl);
      let u;
      try { u = new URL(rawUrl); } catch { return false; }
      if (!u.pathname.endsWith("/auth/works/callback")) return false;

      const errParam = u.searchParams.get("error");
      const fragment = (u.hash && u.hash.startsWith("#")) ? u.hash.slice(1) : "";
      const hashToken = fragment ? new URLSearchParams(fragment).get("token") : null;

      // task 백엔드(api.dyce.kr) 자체의 callback 처리(?code=&state=)는
      // fragment redirect를 발행하기 전 단계 — 가로채지 말고 통과시켜야 한다.
      // 가로채기는 frontend 도메인의 fragment(`#token=...`) 또는 ?error= 도착 시에만.
      if (!errParam && !hashToken) {
        log("callback passthrough (waiting for fragment)");
        return false;
      }

      log("callback hit", { hasFragment: !!fragment, errorParam: errParam });
      if (ev && typeof ev.preventDefault === "function") {
        try { ev.preventDefault(); } catch (_) {}
      }
      try { if (!ssoWin.isDestroyed()) ssoWin.hide(); } catch (_) {}
      if (errParam) {
        finishErr(new Error(decodeURIComponent(errParam)));
        return true;
      }
      // fragment 전체(`token=<JWT>&user=<base64-json>&next=<path>`)를 frontend로 전달.
      // frontend의 decodeWorksToken이 3개 파라미터를 모두 파싱한다.
      finishOk(fragment);
      return true;
    };

    const wc = ssoWin.webContents;
    // 동일 URL이 여러 이벤트로 들어와도 settled 가드로 중복 방지.
    wc.on("will-redirect", (e, url) => tryConsume(url, e));
    wc.on("did-redirect-navigation", (e, url) => tryConsume(url, e));
    wc.on("will-navigate", (e, url) => tryConsume(url, e));
    wc.on("did-navigate", (e, url) => tryConsume(url, e));
    wc.on("did-navigate-in-page", (e, url) => tryConsume(url, e));
    // 실제 페이지 로드가 실패해도(미배포 도메인 등) 이미 fragment를 잡았으면 무시.
    wc.on("did-fail-load", (_e, code, desc, validatedURL) => {
      log("did-fail-load", { code, desc, validatedURL });
      if (!settled) tryConsume(validatedURL, null);
    });

    ssoWin.on("closed", () => {
      log("ssoWin closed", { settled });
      if (!settled) finishErr(new Error("로그인이 취소되었습니다"));
    });

    ssoWin.loadURL(startUrl).then(() => log("loadURL ok")).catch((err) => {
      log("loadURL err", err && err.message);
      finishErr(err);
    });
  });
});

// 앱 생명주기
app.whenReady().then(async () => {
  await createWindow();
  if (app.isPackaged) setupAutoUpdater();
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});
