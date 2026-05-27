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

const host = '127.0.0.1';
const port = 3000;
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

  // Handle API routes first
  if (req.url.startsWith('/api/')) {
    if (req.url === '/api/config') {
      sendJson(res, 200, {
        host: process.env.HOST || '',
        port: process.env.PORT || '',
        user: process.env.USER || '',
        passwordDefined: Boolean(process.env.PASSWORD)
      });
      return;
    }

    if (req.url === '/api/user' && req.method === 'GET') {
      const usersDbPath = path.join(rootDir, 'users.json');
      fs.readFile(usersDbPath, 'utf8', (err, data) => {
        if (err) {
          return sendJson(res, 500, { message: 'Error reading user data' });
        }
        const users = JSON.parse(data);
        const currentUser = users[0]; // Assuming first user is the logged-in one
        sendJson(res, 200, currentUser);
      });
      return;
    }

    if (req.url === '/api/user' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        const updatedUser = JSON.parse(body);
        const usersDbPath = path.join(rootDir, 'users.json');

        fs.readFile(usersDbPath, 'utf8', (err, data) => {
          if (err) {
            return sendJson(res, 500, { message: 'Error reading user data' });
          }
          let users = JSON.parse(data);
          if (users.length > 0) {
            // Merge new data with existing data
            users[0] = { ...users[0], ...updatedUser };
          }
          fs.writeFile(usersDbPath, JSON.stringify(users, null, 2), writeErr => {
            if (writeErr) {
              return sendJson(res, 500, { message: 'Error saving user data' });
            }
            sendJson(res, 200, { message: 'Changes saved successfully!' });
          });
        });
      });
      return;
    }

    // If no API route matches, send a 404
    sendJson(res, 404, { message: 'API endpoint not found' });
    return;
  }

  // Handle static file serving
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
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 - Not Found');
      } else {
        sendFile(res, fallbackFile);
      }
    } else {
      sendFile(res, filePath);
    }
  });
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
  console.log(`Using env: HOST=${process.env.HOST || ''} PORT=${process.env.PORT || ''} USER=${process.env.USER || ''}`);
});
