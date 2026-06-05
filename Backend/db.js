const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const mysqlConfig = {
  host: process.env.DB_HOST || process.env.HOST || '',
  port: Number(process.env.DB_PORT || process.env.PORT || 3306),
  user: process.env.DB_USER || process.env.USER || '',
  password: process.env.DB_PASSWORD || process.env.PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE || process.env.DB_SCHEMA || ''
};

const pool = mysql.createPool({
  ...mysqlConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true
});

async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
}

module.exports = {
  mysqlConfig,
  pool,
  testConnection
};