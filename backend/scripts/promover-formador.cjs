const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const file = path.resolve(__dirname, '..', process.env.DATABASE_PATH || 'data/nexo.db');
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !fs.existsSync(file)) {
  console.error(
    'Regista primeiro a conta na aplicação. Depois: npm run creator -- email@exemplo.pt',
  );
  process.exit(1);
}
const db = new DatabaseSync(file);
const result = db.prepare("UPDATE users SET role = 'CREATOR' WHERE email = ?").run(email);
db.close();
if (!result.changes) {
  console.error('Conta não encontrada.');
  process.exitCode = 1;
} else console.log('Conta promovida a formador. Termina sessão e volta a entrar.');
