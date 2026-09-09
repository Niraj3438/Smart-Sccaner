const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const root = __dirname;
const port = 5173;
const url = `http://127.0.0.1:${port}`;

console.log(`
===========================================
        SmartScan X - Easy Launcher
===========================================
`);

console.log(`Starting SmartScan X on ${url}\n`);

function runNode(script, args = []) {
  return spawn(process.execPath, [script, ...args], {
    cwd: root,
    stdio: "inherit",
    windowsHide: false
  });
}

// Start Vite directly through Node.
// This avoids Windows spawn/path problems.
const vitePath = path.join(
  root,
  "node_modules",
  "vite",
  "bin",
  "vite.js"
);

console.log("Starting Vite...");

const vite = runNode(vitePath, [
  "--host",
  "127.0.0.1",
  "--port",
  String(port)
]);

vite.on("error", (err) => {
  console.error("Vite error:", err);
});

function waitForServer(callback) {
  const request = http.get(url, (res) => {
    res.resume();
    callback();
  });

  request.on("error", () => {
    setTimeout(() => waitForServer(callback), 500);
  });

  request.setTimeout(1000, () => {
    request.destroy();
  });
}

waitForServer(() => {
  console.log(`\nSmartScan X is ready: ${url}`);
  console.log("Starting Electron...\n");

  let electronPath;

  try {
    electronPath = require("electron");
  } catch (error) {
    console.error("Could not find Electron.");
    console.error(error);
    process.exit(1);
  }

  const electron = spawn(
    electronPath,
    [root],
    {
      cwd: root,
      stdio: "inherit",
      windowsHide: false,
      shell: false
    }
  );

  electron.on("error", (err) => {
    console.error("\nSmartScan X Electron error:");
    console.error(err);
  });

  electron.on("close", (code) => {
    console.log(`\nSmartScan X closed. Code: ${code}`);

    if (vite && !vite.killed) {
      vite.kill();
    }

    process.exit(code || 0);
  });
});

process.on("SIGINT", () => {
  if (vite && !vite.killed) vite.kill();
  process.exit(0);
});