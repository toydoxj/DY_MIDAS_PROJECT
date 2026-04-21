const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");
const http = require("http");
const kill = require("tree-kill");

let mainWindow;
let backendProcess;
const BACKEND_PORT = 8000;

// 포트 사용 가능 여부 확인
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

// 백엔드 서버가 응답할 때까지 대기
function waitForBackend(port, maxRetries = 120) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
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
        reject(new Error("백엔드 서버 시작 시간 초과 (60초)"));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

// 백엔드 프로세스 시작
async function startBackend() {
  const available = await isPortAvailable(BACKEND_PORT);
  if (!available) {
    throw new Error(
      `포트 ${BACKEND_PORT}이 이미 사용 중입니다.\n다른 프로그램이 포트를 점유하고 있는지 확인하세요.`
    );
  }

  const backendExe = app.isPackaged
    ? path.join(process.resourcesPath, "backend", "backend.exe")
    : path.join(__dirname, "..", "backend", "dist", "backend", "backend.exe");

  // cwd를 프로젝트 루트(또는 exe 디렉토리)로 설정하여 .env를 찾을 수 있게 함
  const backendCwd = app.isPackaged
    ? path.dirname(backendExe)
    : path.join(__dirname, "..");

  backendProcess = spawn(backendExe, [], {
    env: { ...process.env, BACKEND_PORT: String(BACKEND_PORT), PYTHONIOENCODING: "utf-8" },
    cwd: backendCwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data}`);
  });
  backendProcess.stderr.on("data", (data) => {
    console.error(`[backend] ${data}`);
  });
  backendProcess.on("exit", (code) => {
    console.log(`Backend exited with code ${code}`);
    backendProcess = null;
  });

  await waitForBackend(BACKEND_PORT);
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
    dialog.showErrorBox("MIDAS Dashboard 오류", err.message);
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

  mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);

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
