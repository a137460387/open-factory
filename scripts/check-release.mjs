import { spawn } from 'node:child_process';

const commands = [
  ['bun', ['run', 'typecheck']],
  ['bun', ['run', 'test']],
  ['bun', ['run', 'build']],
  ['bun', ['run', 'e2e']],
  ['bun', ['run', 'tauri:build']],
  ['bun', ['run', 'smoke:golden']],
  ['bun', ['run', 'smoke:preview']],
  ['bun', ['run', 'smoke:cancel']],
  ['bun', ['run', 'smoke:tauri']],
  ['bun', ['run', 'smoke:dialog']]
];

console.log(`Running release checks on ${process.platform}; native Tauri build is required on this platform.`);

for (const [command, args] of commands) {
  await run(command, args);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: new URL('..', import.meta.url),
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with ${signal ?? code}`));
    });
    child.on('error', reject);
  });
}
