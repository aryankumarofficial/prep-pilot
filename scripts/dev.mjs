import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const python = resolve(root, 'backend', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) throw new Error('Create backend/.venv and install requirements first; see README.md.');
if (process.env.APP_ENV === 'production') throw new Error('Use the container start command for production.');
const env = { ...process.env, FRONTEND_ORIGINS: process.env.FRONTEND_ORIGINS ?? JSON.stringify(['http://localhost:5173', 'http://localhost:4173', 'http://localhost:8000', 'http://terminal.local:4173']) };
const children = [
  spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], { cwd: resolve(root, 'backend'), env, stdio: 'inherit' }),
  spawn(process.execPath, [resolve(root, 'frontend/node_modules/vite/bin/vite.js'), '--host', '0.0.0.0', '--port', '4173', '--strictPort'], { cwd: resolve(root, 'frontend'), env, stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  Promise.all(children.map(child => child.exitCode !== null ? Promise.resolve() : new Promise(r => child.once('exit', r)))).then(() => process.exit(code));
  setTimeout(() => { for (const child of children) child.kill('SIGKILL'); process.exit(code); }, 5000).unref();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
}
