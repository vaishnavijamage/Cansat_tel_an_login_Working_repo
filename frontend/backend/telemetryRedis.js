const { createClient } = require("redis");

require("dotenv").config();

const telemetryRedis = createClient({
    url: process.env.TELEMETRY_REDIS_URL,
});

telemetryRedis.on("error", (error) => {
    console.error("Telemetry Redis error:", error);
});

module.exports = telemetryRedis;