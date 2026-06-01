const http = require('http');
const { host, port } = require('./app/config');
const { isUsingMySql } = require('./app/dataStore');
const { handleRequest } = require('./app/router');

// Ponto de entrada do servidor HTTP.
const server = http.createServer(handleRequest);

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
  console.log(`Using env: HOST=${process.env.HOST || ''} PORT=${process.env.PORT || ''} USER=${process.env.USER || ''}`);
  console.log(`Data store: ${isUsingMySql() ? 'MySQL' : 'JSON fallback'}`);
});
