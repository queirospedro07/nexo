const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const projects = [
  'frontend',
  ...(fs.existsSync(path.join(__dirname, 'backend')) ? ['backend'] : []),
];
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Instala o Node.js 24 ou superior.');
  process.exit(1);
}
for (const name of projects) {
  const cwd = path.join(__dirname, name);
  if (!fs.existsSync(path.join(cwd, 'node_modules'))) {
    console.log('A instalar dependências de ' + name + '…');
    const install = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', '--no-audit', '--no-fund'],
      { cwd, stdio: 'inherit', shell: process.platform === 'win32' },
    );
    if (install.status !== 0) process.exit(install.status || 1);
  }
}
if (projects.includes('backend')) {
  const cwd = path.join(__dirname, 'backend');
  if (!fs.existsSync(path.join(cwd, '.env')))
    fs.copyFileSync(path.join(cwd, '.env.example'), path.join(cwd, '.env'));
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 400);
}
if (projects.includes('backend'))
  children.push(
    spawn(process.execPath, ['src/server.cjs'], {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'inherit',
    }),
  );
children.push(
  spawn(
    process.execPath,
    [path.join(__dirname, 'frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'],
    { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' },
  ),
);
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
console.log('Mantém esta janela aberta. Para parar, prime Ctrl+C.');
