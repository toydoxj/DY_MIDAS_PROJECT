const { app, BrowserWindow, dialog } = require("electron");
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
function waitForBackend(port, maxRetries = 30) {
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
        reject(new Error("백엔드 서버 시작 시간 초과 (15초)"));
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

  // .env 파일 탐색: 앱 실행 경로 근처에서 찾기
  const envCandidates = app.isPackaged
    ? [
        path.join(path.dirname(app.getPath("exe")), ".env"),  // exe 옆
        path.join(app.getPath("userData"), ".env"),            // AppData
      ]
    : [path.join(__dirname, "..", ".env")];

  const fs = require("fs");
  let envVars = {};
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) envVars[m[1].trim()] = m[2].trim();
      }
      break;
    }
  }

  backendProcess = spawn(backendExe, [], {
    env: { ...process.env, ...envVars, BACKEND_PORT: String(BACKEND_PORT) },
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

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "MIDAS Dashboard",
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

  autoUpdater.on("update-available", (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "업데이트 알림",
        message: `새 버전 ${info.version}이 있습니다. 다운로드하시겠습니까?`,
        buttons: ["다운로드", "나중에"],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
  });

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "업데이트 준비 완료",
        message: "업데이트가 다운로드되었습니다. 재시작하여 설치하시겠습니까?",
        buttons: ["재시작", "나중에"],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

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
