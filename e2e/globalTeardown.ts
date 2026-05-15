import { execSync } from 'child_process';

const PORTS = [5001, 4173];

function killPid(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(pid, signal);
  } catch {
    /* already dead */
  }
}

function pidsBoundToPort(port: number): number[] {
  try {
    // `lsof -tiTCP:<port> -sTCP:LISTEN` prints one PID per line.
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out
      .split('\n')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    // Non-zero exit means nothing is listening — that's fine.
    return [];
  }
}

export default async function globalTeardown() {
  const stashed: number[] =
    (globalThis as unknown as { __E2E_PIDS?: number[] }).__E2E_PIDS ?? [];

  // 1. SIGTERM the pnpm wrappers we directly spawned.
  for (const pid of stashed) killPid(pid, 'SIGTERM');
  await new Promise((r) => setTimeout(r, 800));

  // 2. Anything still bound to our ports is a grandchild that didn't receive
  //    the propagated signal — SIGKILL it directly.
  const grandchildren = PORTS.flatMap(pidsBoundToPort);
  for (const pid of grandchildren) killPid(pid, 'SIGKILL');

  // 3. Final SIGKILL on the stashed pnpm wrappers in case they're stuck.
  for (const pid of stashed) killPid(pid, 'SIGKILL');

  console.log(
    `[E2E teardown] stashed=${stashed.join(',')} grandchildren=${grandchildren.join(',')}`,
  );
}
