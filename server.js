const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
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

loadEnv(path.join(__dirname, '.env'));

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 3000;
const rootDir = __dirname;

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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);

  stream.on('error', () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 - File not found');
  });

  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
}

function resolveStaticFile(requestPath) {
  let pathname = decodeURIComponent(requestPath.split('?')[0]);
  if (pathname === '/') pathname = '/login.html';

  const normalizedPath = path.normalize(pathname).replace(/^([.]{2}[\/])+/, '');
  const filePath = path.join(rootDir, normalizedPath);

  if (!filePath.startsWith(rootDir)) return null;
  return filePath;
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (req.url.startsWith('/api/config')) {
    sendJson(res, 200, {
      host: process.env.HOST || '',
      port: process.env.PORT || '',
      user: process.env.USER || '',
      passwordDefined: Boolean(process.env.PASSWORD)
    });
    return;
  }

  const filePath = resolveStaticFile(req.url);
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackFile = path.join(rootDir, 'login.html');
      if (req.url === '/' || req.url === '/login.html') {
        sendFile(res, fallbackFile);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - File not found');
      return;
    }

    sendFile(res, filePath);
  });
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
  console.log(`Using env: HOST=${process.env.HOST || ''} PORT=${process.env.PORT || ''} USER=${process.env.USER || ''}`);
});
