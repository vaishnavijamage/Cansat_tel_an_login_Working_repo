/*
 * Central telemetry API endpoint.
 *
 * Every satellite sends telemetry to this endpoint.
 *
 * Flow:
 * Satellite
 *   ↓
 * Fleet authentication
 *   ↓
 * Satellite registration check
 *   ↓
 * Rate limiting
 *   ↓
 * Packet validation
 *   ↓
 * Packet hash generation
 *   ↓
 * Redis Stream
 *   ↓
 * 202 Accepted
 */

const crypto = require("crypto");
const express = require("express");

const {
    authenticateSatellite,
    initializeTelemetrySecurity,
} = require("./telemetrySecurity");

const {
    enqueueTelemetry,
} = require("./telemetryQueue");

const router = express.Router();

const SUPPORTED_SCHEMA_VERSION = 1;

const ALLOWED_TELEMETRY_FIELDS = new Set([
    "altitude_msl",
    "altitude_agl",
    "temperature",
    "humidity",
    "pitch",
    "roll",
    "acceleration",
    "wifi_rssi",
]);

function isFiniteNumber(value) {
    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );
}

function validateOptionalNumber(
    value,
    fieldName,
    min = -Infinity,
    max = Infinity
) {
    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    if (
        !isFiniteNumber(value) ||
        value < min ||
        value > max
    ) {
        return `${fieldName} is invalid.`;
    }

    return null;
}

function validateTelemetryPacket(
    body,
    authenticatedSatelliteId
) {
    if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
    ) {
        return "Invalid JSON payload.";
    }

    /*
     * The satellite ID in the packet must match
     * the authenticated satellite ID from the header.
     */
    if (
        body.satellite_id !==
        authenticatedSatelliteId
    ) {
        return "Satellite identity mismatch.";
    }

    /*
     * Only the currently supported schema version
     * is accepted.
     */
    if (
        body.schema_version !==
        SUPPORTED_SCHEMA_VERSION
    ) {
        return "Unsupported telemetry schema version.";
    }

    /*
     * Timestamp must be supplied in UTC ISO-8601
     * format.
     */
    if (
        typeof body.timestamp !== "string" ||
        !body.timestamp.endsWith("Z")
    ) {
        return "Timestamp must be a UTC ISO-8601 value.";
    }

    const eventTime =
        new Date(body.timestamp);

    if (
        Number.isNaN(
            eventTime.getTime()
        )
    ) {
        return "Invalid timestamp.";
    }

    /*
     * Telemetry object is mandatory.
     */
    if (
        !body.telemetry ||
        typeof body.telemetry !== "object" ||
        Array.isArray(body.telemetry)
    ) {
        return "Telemetry object is required.";
    }

    const telemetry =
        body.telemetry;

    /*
     * Reject fields that are not part of
     * the supported telemetry contract.
     */
    for (
        const field of Object.keys(telemetry)
    ) {
        if (
            !ALLOWED_TELEMETRY_FIELDS.has(
                field
            )
        ) {
            return `Unknown telemetry field: ${field}`;
        }
    }

    /*
     * Required telemetry fields.
     *
     * The field must exist, but the value can
     * temporarily be null if the sensor is unavailable.
     */
    const requiredFields = [
        "altitude_msl",
        "altitude_agl",
        "temperature",
        "humidity",
    ];

    for (
        const field of requiredFields
    ) {
        if (
            !Object.prototype.hasOwnProperty.call(
                telemetry,
                field
            )
        ) {
            return `${field} is required.`;
        }
    }

    /*
     * Validate numeric ranges.
     */
    const validationErrors = [
        validateOptionalNumber(
            telemetry.altitude_msl,
            "altitude_msl"
        ),

        validateOptionalNumber(
            telemetry.altitude_agl,
            "altitude_agl"
        ),

        validateOptionalNumber(
            telemetry.temperature,
            "temperature",
            -100,
            150
        ),

        validateOptionalNumber(
            telemetry.humidity,
            "humidity",
            0,
            100
        ),

        validateOptionalNumber(
            telemetry.pitch,
            "pitch"
        ),

        validateOptionalNumber(
            telemetry.roll,
            "roll"
        ),

        validateOptionalNumber(
            telemetry.acceleration,
            "acceleration",
            0
        ),

        validateOptionalNumber(
            telemetry.wifi_rssi,
            "wifi_rssi",
            -150,
            0
        ),
    ];

    const firstError =
        validationErrors.find(Boolean);

    if (firstError) {
        return firstError;
    }

    return null;
}

function toMySqlUtcDateTime(value) {
    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        throw new Error(
            "Invalid timestamp."
        );
    }

    return date
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
}

/*
 * Single central telemetry endpoint.
 */
router.post(
    "/",
    authenticateSatellite,
    async (req, res) => {
        try {
            /*
             * Initialize Redis-backed rate limiter.
             */
            const rateLimiter =
                await initializeTelemetrySecurity();

            let rateLimitFinished =
                false;

            await new Promise(
                (resolve) => {
                    rateLimiter(
                        req,
                        res,
                        () => {
                            rateLimitFinished = true;
                            resolve();
                        }
                    );
                }
            );

            /*
             * If the rate limiter already returned
             * a response such as 429, stop here.
             */
            if (!rateLimitFinished) {
                return;
            }

            /*
             * Only JSON telemetry requests are accepted.
             */
            if (
                !req.is("application/json")
            ) {
                return res.status(415).json({
                    success: false,
                    message:
                        "Content-Type must be application/json.",
                });
            }

            /*
             * Validate incoming telemetry.
             */
            const validationError =
                validateTelemetryPacket(
                    req.body,
                    req.telemetrySatelliteId
                );

            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError,
                });
            }

            /*
             * Normalize telemetry fields.
             *
             * This creates a stable structure which is also
             * used when creating the packet hash.
             */
            const telemetry =
                req.body.telemetry;

            const normalizedTelemetry = {
                altitude_msl:
                    telemetry.altitude_msl ?? null,

                altitude_agl:
                    telemetry.altitude_agl ?? null,

                temperature:
                    telemetry.temperature ?? null,

                humidity:
                    telemetry.humidity ?? null,

                pitch:
                    telemetry.pitch ?? null,

                roll:
                    telemetry.roll ?? null,

                acceleration:
                    telemetry.acceleration ?? null,

                wifi_rssi:
                    telemetry.wifi_rssi ?? null,
            };

            /*
             * Generate a deterministic SHA-256 packet hash.
             *
             * IMPORTANT:
             * received_at is intentionally NOT included.
             *
             * That allows the exact same packet to produce
             * the exact same hash when it is retried later.
             */
            const packetHash =
                crypto
                    .createHash("sha256")
                    .update(
                        JSON.stringify({
                            satellite_id:
                                req.telemetrySatelliteId,

                            schema_version:
                                req.body.schema_version,

                            timestamp:
                                req.body.timestamp,

                            telemetry:
                                normalizedTelemetry,
                        }),
                        "utf8"
                    )
                    .digest("hex");

            const receivedAt =
                new Date();

            /*
             * Final normalized packet sent to Redis.
             */
            const packet = {
                satellite_id:
                    req.telemetrySatelliteId,

                packet_hash:
                    packetHash,

                schema_version:
                    req.body.schema_version,

                event_time:
                    toMySqlUtcDateTime(
                        req.body.timestamp
                    ),

                received_at:
                    toMySqlUtcDateTime(
                        receivedAt.toISOString()
                    ),

                ...normalizedTelemetry,
            };

            /*
             * The ingest API ends its job once Redis
             * safely accepts the packet.
             *
             * MySQL processing is performed by the worker.
             */
            const streamId =
                await enqueueTelemetry(
                    packet
                );

            return res.status(202).json({
                success: true,
                message:
                    "Telemetry accepted.",
                stream_id:
                    streamId,
            });
        } catch (error) {
            console.error(
                "Telemetry ingest error:",
                error
            );

            /*
             * Never claim success if the packet
             * could not be safely queued.
             */
            return res.status(503).json({
                success: false,
                message:
                    "Telemetry temporarily unavailable. Please retry.",
            });
        }
    }
);

module.exports = router;