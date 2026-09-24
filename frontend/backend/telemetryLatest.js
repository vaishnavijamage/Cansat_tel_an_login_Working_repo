const telemetryRedis = require("./telemetryRedis");

require("dotenv").config();

const LATEST_HASH =
    process.env.TELEMETRY_LATEST_HASH ||
    "telemetry:latest";

/*
 * Keep the packet with the newest event_time.
 *
 * If event_time is equal, the packet that was received
 * later is treated as the latest state.
 */
const UPDATE_LATEST_SCRIPT = `
local currentJson =
    redis.call("HGET", KEYS[1], ARGV[1])

if not currentJson then
    redis.call(
        "HSET",
        KEYS[1],
        ARGV[1],
        ARGV[2]
    )

    return 1
end

local ok, current =
    pcall(cjson.decode, currentJson)

if not ok then
    redis.call(
        "HSET",
        KEYS[1],
        ARGV[1],
        ARGV[2]
    )

    return 1
end

local incomingEventTime = ARGV[3]
local currentEventTime =
    current.event_time or ""

if incomingEventTime > currentEventTime then
    redis.call(
        "HSET",
        KEYS[1],
        ARGV[1],
        ARGV[2]
    )

    return 1
end

if incomingEventTime == currentEventTime then
    local incomingReceivedAt = ARGV[4]
    local currentReceivedAt =
        current.received_at or ""

    if incomingReceivedAt >= currentReceivedAt then
        redis.call(
            "HSET",
            KEYS[1],
            ARGV[1],
            ARGV[2]
        )

        return 1
    end
end

return 0
`;


/*
 * Update the latest state of one satellite.
 */
async function updateLatestTelemetry(packet) {
    if (!telemetryRedis.isOpen) {
        await telemetryRedis.connect();
    }

    if (!packet.satellite_id) {
        throw new Error(
            "Cannot update latest telemetry without satellite_id."
        );
    }

    if (!packet.event_time) {
        throw new Error(
            `Cannot update latest telemetry for ${packet.satellite_id} without event_time.`
        );
    }

    await telemetryRedis.eval(
        UPDATE_LATEST_SCRIPT,
        {
            keys: [LATEST_HASH],

            arguments: [
                packet.satellite_id,
                JSON.stringify(packet),
                String(packet.event_time),
                String(packet.received_at || ""),
            ],
        }
    );
}


/*
 * Update latest state for a batch of packets.
 */
async function updateLatestTelemetryBatch(packets) {
    if (
        !Array.isArray(packets) ||
        packets.length === 0
    ) {
        return 0;
    }

    for (const packet of packets) {
        await updateLatestTelemetry(packet);
    }

    return packets.length;
}


/*
 * Get latest telemetry for one satellite.
 */
async function getLatestTelemetry(satelliteId) {
    if (!telemetryRedis.isOpen) {
        await telemetryRedis.connect();
    }

    const value =
        await telemetryRedis.hGet(
            LATEST_HASH,
            satelliteId
        );

    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        console.error(
            `Invalid latest telemetry cache for ${satelliteId}:`,
            error
        );

        return null;
    }
}


/*
 * Get latest telemetry for all satellites.
 */
async function getAllLatestTelemetry() {
    if (!telemetryRedis.isOpen) {
        await telemetryRedis.connect();
    }

    const values =
        await telemetryRedis.hGetAll(
            LATEST_HASH
        );

    const result = [];

    for (
        const [satelliteId, value]
        of Object.entries(values)
    ) {
        try {
            result.push(
                JSON.parse(value)
            );
        } catch (error) {
            console.error(
                `Invalid latest telemetry cache for ${satelliteId}:`,
                error
            );
        }
    }

    return result;
}


module.exports = {
    LATEST_HASH,
    updateLatestTelemetry,
    updateLatestTelemetryBatch,
    getLatestTelemetry,
    getAllLatestTelemetry,
};