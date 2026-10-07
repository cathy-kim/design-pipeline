#!/usr/bin/env node
/**
 * wait-for-server.js — dev 서버가 응답할 때까지 기다린다 (webapp-testing/with_server.py 대체).
 *
 * Usage:
 *   node wait-for-server.js --url http://localhost:3000 [--timeout 60000]
 *   node wait-for-server.js --url http://localhost:3000 --start "npm run dev" [--cwd .] -- <cmd> [args...]
 *
 * --start 가 있으면 서버를 띄운다.
 *   `-- <cmd>` 가 있으면 준비 후 cmd 를 실행하고, 끝나면 서버를 종료하고 cmd 의 종료 코드로 끝난다.
 *   `-- <cmd>` 가 없으면 서버를 남겨 두고 PID 를 stdout 에 출력한다 (종료: kill <pid>).
 * 응답 코드가 무엇이든(HTTP 응답이 오면) 준비된 것으로 본다. exit 0 = 준비, 1 = 타임아웃/실패.
 */
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const own = sep === -1 ? argv : argv.slice(0, sep);
const cmd = sep === -1 ? [] : argv.slice(sep + 1);
const opt = { url: null, timeout: 60000, start: null, cwd: process.cwd() };
for (let i = 0; i < own.length; i++) {
  let [k, v] = own[i].replace(/^--/, '').split(/=(.*)/s);
  if (v === undefined) v = own[++i];
  if (k in opt) opt[k] = k === 'timeout' ? Number(v) : v;
}
if (!opt.url) {
  process.stderr.write('Usage: node wait-for-server.js --url <url> [--timeout ms] [--start "cmd"] [--cwd dir] [-- cmd ...]\n');
  process.exit(1);
}

let server = null;
if (opt.start) {
  server = spawn(opt.start, { shell: true, cwd: opt.cwd, stdio: ['ignore', 'inherit', 'inherit'], detached: true });
  server.on('exit', (code) => {
    if (!ready) {
      process.stderr.write(`[wait-for-server] server exited early (code ${code})\n`);
      process.exit(1);
    }
  });
}
const stopServer = () => {
  if (server && server.exitCode === null) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
  }
};

let ready = false;
const deadline = Date.now() + opt.timeout;
while (Date.now() < deadline) {
  try {
    await fetch(opt.url, { signal: AbortSignal.timeout(3000) });
    ready = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!ready) {
  process.stderr.write(`[wait-for-server] ${opt.url} not ready after ${opt.timeout}ms\n`);
  stopServer();
  process.exit(1);
}
process.stderr.write(`[wait-for-server] ready: ${opt.url}\n`);

if (!cmd.length) {
  if (server) {
    server.unref();
    process.stdout.write(`${server.pid}\n`);
  }
  process.exit(0);
}
const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit' });
child.on('exit', (code) => {
  stopServer();
  process.exit(code ?? 1);
});
