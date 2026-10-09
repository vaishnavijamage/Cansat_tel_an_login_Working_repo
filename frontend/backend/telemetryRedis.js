const { createClient } = require("redis");

require("dotenv").config();

const CONNECT_TIMEOUT_MS =
    Number(process.env.TELEMETRY_REDIS_CONNECT_TIMEOUT_MS) || 1000;

/* The ingest client fails immediately while Redis reconnects in the background. */
const telemetryRedis = createClient({
    url: process.env.TELEMETRY_REDIS_URL,
    disableOfflineQueue: true,
    socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: (retries) => Math.min(1000, 50 * (retries + 1)),
    },
});

let connectPromise = null;

telemetryRedis.on("error", (error) => {
    console.error("Telemetry Redis error:", error.message);
});

telemetryRedis.on("ready", () => {
    console.log("Telemetry Redis is ready.");
});

function isTelemetryRedisReady() {
    return telemetryRedis.isOpen && telemetryRedis.isReady;
}

/* Start reconnection in the background; HTTP requests never wait for it. */
async function connectTelemetryRedis() {
    if (isTelemetryRedisReady()) {
        return true;
    }

    if (!telemetryRedis.isOpen && !connectPromise) {
        connectPromise = telemetryRedis.connect()
            .then(() => true)
            .catch((error) => {
                console.error("Telemetry Redis initial connection failed:", error.message);
                return false;
            })
            .finally(() => {
                connectPromise = null;
            });
    }

    return connectPromise || false;
}

module.exports = telemetryRedis;
module.exports.isTelemetryRedisReady = isTelemetryRedisReady;
module.exports.connectTelemetryRedis = connectTelemetryRedis;