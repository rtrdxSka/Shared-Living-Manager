import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'BackEnd');

const BACKEND_PORT = 5001;
const FRONTEND_PORT = 4173;

// Initialise the PID stash up front so any spawned process can register itself
// for teardown immediately — before any await — even if a later step throws.
const pidStash: number[] = [];
(globalThis as unknown as { __E2E_PIDS: number[] }).__E2E_PIDS = pidStash;

function stash(p: ChildProcess) {
  if (typeof p.pid === 'number') pidStash.push(p.pid);
}

function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve();
          else if (Date.now() > deadline)
            reject(new Error(`Timeout waiting for ${url}: status=${res.statusCode}`));
          else setTimeout(tick, 500);
        })
        .on('error', () => {
          if (Date.now() > deadline) reject(new Error(`Timeout waiting for ${url}`));
          else setTimeout(tick, 500);
        });
    };
    tick();
  });
}

export default async function globalSetup() {
  // 1. Ensure mongo container is up (reuses BackEnd/docker-compose.test.yml).
  console.log('[E2E setup] Starting test MongoDB container...');
  const dbUp = spawn('pnpm', ['--filter', 'backend', 'test:db:up'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  await new Promise<void>((resolve, reject) => {
    dbUp.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`mongo up failed: ${code}`)),
    );
  });

  // 2. Build the frontend FIRST (before spawning any long-lived process),
  //    bypassing `tsc -b` because pre-existing test files in __tests__ fail
  //    strict type-check on jest-dom matchers — irrelevant to building the
  //    bundle. `vite build` only strips types, never type-checks.
  console.log(
    '[E2E setup] Building frontend with VITE_API_BASE_URL=http://localhost:5001/api ...',
  );
  const build = spawn('pnpm', ['--filter', 'frontend', 'exec', 'vite', 'build'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      VITE_API_BASE_URL: `http://localhost:${BACKEND_PORT}/api`,
    },
    stdio: 'inherit',
  });
  await new Promise<void>((resolve, reject) => {
    build.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`frontend build failed: ${code}`)),
    );
  });

  // 3. Spawn the frontend preview server.
  //    Vite preview inherits `server.proxy` from vite.config.ts, which proxies
  //    /api → process.env.VITE_API_PROXY_TARGET (default "http://backend:5000",
  //    a docker-compose hostname unreachable outside its network). Point it
  //    at our E2E backend.
  console.log('[E2E setup] Starting vite preview on :4173...');
  const frontend = spawn(
    'pnpm',
    [
      '--filter',
      'frontend',
      'exec',
      'vite',
      'preview',
      '--port',
      String(FRONTEND_PORT),
      '--strictPort',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        VITE_API_PROXY_TARGET: `http://localhost:${BACKEND_PORT}`,
      },
      stdio: 'inherit',
    },
  );
  stash(frontend);

  // 4. Spawn the backend.
  console.log('[E2E setup] Spawning backend on :5001...');
  const backend = spawn('pnpm', ['start:e2e'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(BACKEND_PORT),
      MONGODB_URI:
        process.env.MONGODB_URI ??
        `mongodb://127.0.0.1:27018/slm-e2e?directConnection=true`,
      JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-jwt-secret',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'e2e-jwt-access-secret',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'e2e-jwt-refresh-secret',
      RESEND_API_KEY: 'e2e-mocked',
      FROM_EMAIL: 'e2e@example.com',
      FRONTEND_URL: `http://localhost:${FRONTEND_PORT}`,
      BCRYPT_SALT_ROUNDS: '4',
    },
    stdio: 'inherit',
  });
  stash(backend);

  // 5. Wait for both to respond on their healthchecks.
  await waitForHttp(`http://localhost:${BACKEND_PORT}/health`);
  console.log('[E2E setup] Backend healthy.');
  await waitForHttp(`http://localhost:${FRONTEND_PORT}/`);
  console.log('[E2E setup] Frontend healthy.');
}
