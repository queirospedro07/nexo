const path = require('node:path');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const http = require('node:http');
const { createApp } = require('./app.cjs');
let secret = process.env.JWT_SECRET;
if (!secret) {
  const secretFile = path.resolve(__dirname, '../data/.session-secret');
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  if (!fs.existsSync(secretFile))
    fs.writeFileSync(secretFile, randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
  secret = fs.readFileSync(secretFile, 'utf8').trim();
}
const instance = createApp({
  databasePath: process.env.DATABASE_PATH
    ? path.resolve(__dirname, '..', process.env.DATABASE_PATH)
    : undefined,
  secret,
});
const server = http.createServer(instance.app);

const port = Number(process.env.PORT || 5304);
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? 'A porta ' +
          port +
          ' está ocupada. Fecha a outra instância ou altera PORT e o proxy em vite.config.js.'
      : error.message,
  );
  instance.close();
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log('NEXO API: http://127.0.0.1:' + port));
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    instance.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
