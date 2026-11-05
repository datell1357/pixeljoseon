// 서버와 Vite를 함께 띄운다
import { spawn } from 'node:child_process';
const run = (args) => spawn('npx', args, { stdio: 'inherit', env: process.env });
const procs = [run(['tsx', 'watch', 'server/src/index.ts']), run(['vite'])];
const stop = () => { for (const p of procs) p.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
