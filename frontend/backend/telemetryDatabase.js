const mysql = require("mysql2/promise");
require("dotenv").config();

const telemetryPool = mysql.createPool({
    host: process.env.TELEMETRY_DB_HOST,
    port: Number(process.env.TELEMETRY_DB_PORT) || 3306,
    user: process.env.TELEMETRY_DB_USER,
    password: process.env.TELEMETRY_DB_PASSWORD,
    database: process.env.TELEMETRY_DB_NAME,

    waitForConnections: true,
    connectionLimit:
        Number(
            process.env.TELEMETRY_DB_CONNECTION_LIMIT
        ) || 200,
    queueLimit: 0,

    enableKeepAlive: true,
});

module.exports = telemetryPool;
