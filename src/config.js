const fs = require('fs');
const path = require('path');

// Configuração base partilhada por todo o servidor.
function loadEnv(filePath) {
  // Lê o ficheiro .env sem depender de bibliotecas externas.
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const rootDir = path.resolve(__dirname, '../public');
loadEnv(path.join(rootDir, '..', '.env'));

// O servidor HTTP continua local; a ligação MySQL usa as credenciais do .env.
const host = '127.0.0.1';
const port = 3000;
const projectRoot = path.resolve(__dirname, '..');
const apiDataPath = path.join(projectRoot, 'data', 'api-data.json');
const usersDbPath = path.join(projectRoot, 'data', 'users.json');
const dbHost = process.env.DB_HOST || process.env.HOST || '';
const dbPort = Number(process.env.DB_PORT || process.env.PORT || 3306);
const dbUser = process.env.DB_USER || process.env.USER || '';
const dbPassword = process.env.DB_PASSWORD || process.env.PASSWORD || '';
const dbName = process.env.DB_NAME || process.env.DATABASE || process.env.DB_SCHEMA || process.env.USER || '';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

module.exports = {
  host,
  port,
  rootDir,
  apiDataPath,
  dbConfig: {
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName
  },
  dbHost,
  dbName,
  dbPassword,
  dbPort,
  dbUser,
  usersDbPath,
  mimeTypes
};
