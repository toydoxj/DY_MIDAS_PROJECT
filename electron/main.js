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

  backendExitInfo = null;
  backendProcess = spawn(backendExe, [], {
    env: { ...process.env, BACKEND_PORT: String(backendPort), PYTHONIOENCODING: "utf-8" },
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

  autoUpdater.on("update-available", (info) => {
    const releaseNotes = typeof info.releaseNotes === "string"
      ? info.releaseNotes
      : Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map((n) => n.note || n).join("\n")
        : "";

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
