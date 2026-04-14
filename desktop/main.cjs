const { app, BrowserWindow, dialog } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

let mainWindow = null;
let sidecarProcess = null;
let sidecarPort = null;

app.setName("Hermes-shops");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a local port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function resolveBundledPython() {
  const sidecarRoot = path.join(process.resourcesPath, "sidecar", "venv");
  const candidates = process.platform === "win32"
    ? [
        path.join(sidecarRoot, "Scripts", "python.exe"),
        path.join(sidecarRoot, "Scripts", "python")
      ]
    : [
        path.join(sidecarRoot, "bin", "python3"),
        path.join(sidecarRoot, "bin", "python")
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Bundled sidecar python was not found under ${sidecarRoot}`);
}

function resolveDevPython() {
  const explicit = process.env.HERMES_DESKTOP_PYTHON;
  if (explicit) {
    return explicit;
  }
  const repoVenv = path.resolve(__dirname, "..", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python3");
  if (fs.existsSync(repoVenv)) {
    return repoVenv;
  }
  return process.platform === "win32" ? "python" : "python3";
}

function resolveBundledNodeHome() {
  const explicit = process.env.HERMES_DESKTOP_NODE_HOME;
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  const candidates = [];
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "node-runtime"));
  } else {
    candidates.push(path.resolve(__dirname, "dist", "node-runtime"));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function collectNodePathEntries(nodeHome) {
  if (!nodeHome) {
    return [];
  }

  const candidates = process.platform === "win32"
    ? [
        nodeHome,
        path.join(nodeHome, "Scripts"),
        path.join(nodeHome, "node_modules", ".bin"),
      ]
    : [
        path.join(nodeHome, "bin"),
        path.join(nodeHome, "node_modules", ".bin"),
        nodeHome,
      ];

  return candidates.filter((candidate) => fs.existsSync(candidate));
}

function buildSidecarEnv() {
  const userData = app.getPath("userData");
  const hermesHome = path.join(userData, "hermes-home");
  fs.mkdirSync(hermesHome, { recursive: true });

  const env = {
    ...process.env,
    HERMES_HOME: hermesHome,
    PYTHONUNBUFFERED: "1",
  };

  const bundledNodeHome = resolveBundledNodeHome();
  if (bundledNodeHome) {
    env.HERMES_DESKTOP_NODE_HOME = bundledNodeHome;
    env.PLAYWRIGHT_BROWSERS_PATH = path.join(bundledNodeHome, "ms-playwright");
    const pathEntries = collectNodePathEntries(bundledNodeHome);
    if (pathEntries.length > 0) {
      env.PATH = `${pathEntries.join(path.delimiter)}${path.delimiter}${env.PATH || ""}`;
    }
  }

  return env;
}

function startSidecar(port) {
  const python = app.isPackaged ? resolveBundledPython() : resolveDevPython();
  const args = ["-m", "hermes_server.desktop_entry", "--port", String(port)];
  console.log(`[desktop] starting sidecar on port ${port} via ${python}`);
  sidecarProcess = spawn(python, args, {
    env: buildSidecarEnv(),
    stdio: "pipe",
  });

  sidecarProcess.stdout.on("data", (chunk) => {
    process.stdout.write(`[sidecar] ${chunk}`);
  });
  sidecarProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[sidecar] ${chunk}`);
  });
  sidecarProcess.on("exit", (code, signal) => {
    if (!app.isQuitting) {
      dialog.showErrorBox(
        "Hermes-shops sidecar exited",
        `The local Hermes sidecar stopped unexpectedly (code: ${code ?? "unknown"}, signal: ${signal ?? "none"}).`
      );
      app.quit();
    }
  });
}

function waitForSidecar(port, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(
        {
          host: "127.0.0.1",
          port,
          path: "/health",
          timeout: 2000,
        },
        (res) => {
          if (res.statusCode === 200) {
            res.resume();
            resolve();
            return;
          }
          res.resume();
          retry(new Error(`Unexpected health status: ${res.statusCode}`));
        }
      );

      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy(new Error("Health request timed out"));
      });
    };

    const retry = (error) => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(error);
        return;
      }
      setTimeout(tick, 500);
    };

    tick();
  });
}

function createMainWindow(port) {
  console.log(`[desktop] loading renderer from http://127.0.0.1:${port}`);
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    title: "Hermes-shops",
    backgroundColor: "#f4efe4",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  void mainWindow.loadURL(`http://127.0.0.1:${port}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function boot() {
  sidecarPort = await getFreePort();
  startSidecar(sidecarPort);
  await waitForSidecar(sidecarPort);
  createMainWindow(sidecarPort);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await boot();
    } catch (error) {
      dialog.showErrorBox(
        "Failed to start Hermes-shops",
        error instanceof Error ? error.message : String(error)
      );
      app.quit();
    }
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (sidecarProcess && !sidecarProcess.killed) {
    sidecarProcess.kill();
  }
});
