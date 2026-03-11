import { existsSync, watch } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const cwd = process.cwd();
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rendererPort = 5173;
const mainEntry = join(cwd, 'dist-electron', 'main', 'main.js');
const preloadEntry = join(cwd, 'dist-electron', 'preload', 'preload.js');

let rendererProcess;
let mainProcess;
let electronProcess;
let shuttingDown = false;
let restartTimer = undefined;

function spawnProcess(command, args, env = {}) {
  return spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

function waitForPort(port) {
  return new Promise((resolve) => {
    const probe = () => {
      const socket = net.createConnection({ port, host: '127.0.0.1' });

      socket.once('connect', () => {
        socket.end();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();
        setTimeout(probe, 250);
      });
    };

    probe();
  });
}

async function waitForFile(filePath) {
  while (!existsSync(filePath)) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await access(filePath);
}

function stopChild(child) {
  if (child && !child.killed) {
    child.kill();
  }
}

function launchElectron() {
  if (shuttingDown) {
    return;
  }

  stopChild(electronProcess);
  electronProcess = spawnProcess(npmCmd, ['exec', '--', 'electron', mainEntry], {
    VITE_DEV_SERVER_URL: `http://127.0.0.1:${rendererPort}`,
  });

  electronProcess.on('exit', (code) => {
    if (!shuttingDown && code !== 0 && code !== null) {
      shutdown(code ?? 1);
    }
  });
}

function scheduleRestart() {
  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    launchElectron();
  }, 250);
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  stopChild(electronProcess);
  stopChild(rendererProcess);
  stopChild(mainProcess);
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

rendererProcess = spawnProcess(npmCmd, ['run', 'dev:renderer']);
mainProcess = spawnProcess(npmCmd, ['run', 'dev:main']);

mainProcess.on('exit', (code) => {
  if (!shuttingDown && code !== 0) {
    shutdown(code ?? 1);
  }
});

rendererProcess.on('exit', (code) => {
  if (!shuttingDown && code !== 0) {
    shutdown(code ?? 1);
  }
});

await Promise.all([waitForPort(rendererPort), waitForFile(mainEntry), waitForFile(preloadEntry)]);
launchElectron();

for (const filePath of [mainEntry, preloadEntry]) {
  watch(filePath, { persistent: true }, scheduleRestart);
}
