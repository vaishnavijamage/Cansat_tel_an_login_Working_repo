const telemetryRedis = require("./telemetryRedis");

require("dotenv").config();

const STREAM_NAME =
    process.env.TELEMETRY_REDIS_STREAM ||
    "telemetry:ingest";

const GROUP_NAME =
    process.env.TELEMETRY_REDIS_GROUP ||
    "telemetry-workers";

let queueReady = false;
let queueInitPromise = null;

function redisUnavailableError() {
    const error = new Error("Telemetry queue is unavailable.");
    error.code = "TELEMETRY_QUEUE_UNAVAILABLE";
    return error;
}

function requireReadyRedis() {
    if (!telemetryRedis.isTelemetryRedisReady()) {
        throw redisUnavailableError();
    }
}

/* Create the stream/group once per process, not once for every POST. */
async function ensureTelemetryQueue() {
    requireReadyRedis();

    if (queueReady) {
        return;
    }

    if (!queueInitPromise) {
        queueInitPromise = telemetryRedis.xGroupCreate(
            STREAM_NAME,
            GROUP_NAME,
            "$",
            { MKSTREAM: true }
        ).catch((error) => {
            if (!String(error.message).includes("BUSYGROUP")) {
                throw error;
            }
        }).then(() => {
            queueReady = true;
        }).finally(() => {
            queueInitPromise = null;
        });
    }

    return queueInitPromise;
}

async function enqueueTelemetry(packet) {
    await ensureTelemetryQueue();

    return telemetryRedis.xAdd(STREAM_NAME, "*", {
        packet_id: `${packet.satellite_id}:${packet.packet_hash}`,
        satellite_id: packet.satellite_id,
        payload: JSON.stringify(packet),
    });
}

module.exports = {
    STREAM_NAME,
    GROUP_NAME,
    ensureTelemetryQueue,
    enqueueTelemetry,
    redisUnavailableError,
};
