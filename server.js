const express = require('express');
const cors = require('cors');
const { host, port } = require('./src/config');
const { isUsingMySql } = require('./src/dataStore');
const { handleRequest } = require('./src/router');
const { testConnection } = require('./db');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  try {
    const result = handleRequest(req, res);
    if (result && typeof result.then === 'function') {
      result.catch(next);
    }
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).json({
    description: 'Internal server error',
    errors: { server: [error.message || 'Unexpected error'] }
  });
});

(async () => {
  try {
    await testConnection();
    console.log('MySQL connection test: ok');
  } catch (error) {
    console.warn(`MySQL connection test failed: ${error.message}`);
  }

  app.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
    console.log(`Data store: ${isUsingMySql() ? 'MySQL' : 'JSON fallback'}`);
  });
})();
