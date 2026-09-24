const telemetryRedis = require("./telemetryRedis");

require("dotenv").config();

const STREAM_NAME =
    process.env.TELEMETRY_REDIS_STREAM ||
    "telemetry:ingest";

const GROUP_NAME =
    process.env.TELEMETRY_REDIS_GROUP ||
    "telemetry-workers";

/**
 * Make sure Redis is connected.
 */
async function ensureRedisConnection() {
    if (!telemetryRedis.isOpen) {
        await telemetryRedis.connect();
    }
}

/**
 * Create the telemetry stream and consumer group
 * if they do not already exist.
 */
async function ensureTelemetryQueue() {
    await ensureRedisConnection();

    try {
        await telemetryRedis.xGroupCreate(
            STREAM_NAME,
            GROUP_NAME,
            "$",
            {
                MKSTREAM: true,
            }
        );
    } catch (error) {
        if (!String(error.message).includes("BUSYGROUP")) {
            throw error;
        }
    }
}

/**
 * Add one telemetry packet to the Redis Stream.
 */
async function enqueueTelemetry(packet) {
    await ensureTelemetryQueue();

    const packetId =
        `${packet.satellite_id}:${packet.packet_hash}`;

    const streamId =
        await telemetryRedis.xAdd(
            STREAM_NAME,
            "*",
            {
                packet_id: packetId,
                satellite_id:
                    packet.satellite_id,
                payload:
                    JSON.stringify(packet),
            }
        );

    return streamId;
}

module.exports = {
    STREAM_NAME,
    GROUP_NAME,
    ensureTelemetryQueue,
    enqueueTelemetry,
};