const aedes = require("aedes")();
const server = require("aedes-server-factory").createServer(aedes);
const crypto = require("crypto");
const fs = require("fs");
const tls = require("tls");

const {
    safeSecretCompare,
    getCachedSatellite,
    initializeTelemetrySecurity
} = require("./telemetrySecurity");

const {
    validateTelemetryPacket,
    toMySqlUtcDateTime
} = require("./telemetryRoutes");

const { enqueueTelemetry } = require("./telemetryQueue");
const telemetryRedis = require("./telemetryRedis");

const FLEET_API_KEY = process.env.TELEMETRY_FLEET_API_KEY;

// Rate limiting setup
let rateLimiter = null;

// MQTT authentication
aedes.authenticate = async (client, username, password, callback) => {
    try {
        if (!username || !password) {
            return callback(null, false);
        }

        const satelliteId = username.toString().trim();
        const suppliedKey = password.toString().trim();

        if (!/^[A-Za-z0-9_-]{1,50}$/.test(satelliteId)) {
            return callback(null, false);
        }

        if (!safeSecretCompare(suppliedKey, FLEET_API_KEY)) {
            return callback(null, false);
        }

        const satellite = await getCachedSatellite(satelliteId);

        if (!satellite || !satellite.is_active) {
            console.log(
                "Auth Failed: satellite not found or inactive",
                satelliteId
            );
            return callback(null, false);
        }

        console.log("Auth Success for", satelliteId);

        client.satelliteId = satellite.satellite_id;
        client.satellite = satellite;

        return callback(null, true);
    } catch (error) {
        console.error("MQTT Auth Error:", error);
        return callback(error, false);
    }
};

// MQTT publish authorization
aedes.authorizePublish = (client, packet, callback) => {
    console.log(
        "AuthorizePublish:",
        packet.topic,
        "for client",
        client ? client.satelliteId : "internal"
    );

    if (!client) {
        return callback(null);
    }

    if (packet.topic === `telemetry/${client.satelliteId}`) {
        return callback(null);
    }

    console.log(
        "Unauthorized topic:",
        packet.topic,
        "expected:",
        `telemetry/${client.satelliteId}`
    );

    return callback(new Error("Unauthorized topic"));
};

// Satellites do not subscribe
aedes.authorizeSubscribe = (client, sub, callback) => {
    callback(new Error("Subscriptions not permitted"));
};

// MQTT telemetry ingestion
aedes.on("publish", async (packet, client) => {
    if (!client) return;
    if (!packet.topic.startsWith("telemetry/")) return;

    try {
        if (!telemetryRedis.isTelemetryRedisReady()) {
            return;
        }

        if (!rateLimiter) {
            rateLimiter = await initializeTelemetrySecurity();
        }

        const req = {
            telemetrySatelliteId: client.satelliteId,
            headers: {}
        };

        let rateLimitPassed = false;
        let finished = false;

        await new Promise((resolve) => {
            const res = {
                status: () => res,

                json: () => {
                    if (!finished) {
                        finished = true;
                        resolve();
                    }
                },

                setHeader: () => { },

                end: () => {
                    if (!finished) {
                        finished = true;
                        resolve();
                    }
                }
            };

            rateLimiter(req, res, () => {
                if (!finished) {
                    rateLimitPassed = true;
                    finished = true;
                    resolve();
                }
            });
        });

        if (!rateLimitPassed) {
            return;
        }

        const payloadStr = packet.payload.toString();

        let body;

        try {
            body = JSON.parse(payloadStr);
        } catch (error) {
            return;
        }

        const validationError = validateTelemetryPacket(
            body,
            client.satelliteId
        );

        if (validationError) {
            return;
        }

        const telemetry = body.telemetry;

        const normalizedTelemetry = {
            altitude_msl: telemetry.altitude_msl ?? null,
            altitude_agl: telemetry.altitude_agl ?? null,
            temperature: telemetry.temperature ?? null,
            humidity: telemetry.humidity ?? null,
            pitch: telemetry.pitch ?? null,
            roll: telemetry.roll ?? null,
            acceleration: telemetry.acceleration ?? null,
            wifi_rssi: telemetry.wifi_rssi ?? null
        };

        const packetHash = crypto
            .createHash("sha256")
            .update(
                JSON.stringify({
                    satellite_id: client.satelliteId,
                    schema_version: body.schema_version,
                    timestamp: body.timestamp,
                    telemetry: normalizedTelemetry
                }),
                "utf8"
            )
            .digest("hex");

        const receivedAt = new Date();

        const dbPacket = {
            satellite_id: client.satelliteId,
            packet_hash: packetHash,
            schema_version: body.schema_version,
            event_time: toMySqlUtcDateTime(body.timestamp),
            received_at: toMySqlUtcDateTime(receivedAt.toISOString()),
            ...normalizedTelemetry
        };

        await enqueueTelemetry(dbPacket);
    } catch (error) {
        console.error("MQTT Ingest Error:", error);
    }
});

const MQTT_PORT = process.env.MQTT_PORT || 1883;
const MQTTS_PORT = process.env.MQTTS_PORT || 8883;

function startMqttBroker() {
    server.listen(MQTT_PORT, () => {
        console.log(`MQTT broker listening on port ${MQTT_PORT}`);
    });

    if (
        process.env.MQTT_TLS_KEY_PATH &&
        process.env.MQTT_TLS_CERT_PATH
    ) {
        try {
            const options = {
                key: fs.readFileSync(process.env.MQTT_TLS_KEY_PATH),
                cert: fs.readFileSync(process.env.MQTT_TLS_CERT_PATH)
            };

            const tlsServer = tls.createServer(
                options,
                aedes.handle
            );

            tlsServer.listen(MQTTS_PORT, () => {
                console.log(
                    `MQTTS broker listening on port ${MQTTS_PORT}`
                );
            });
        } catch (error) {
            console.error(
                "Failed to start MQTTS server:",
                error.message
            );
        }
    }
}

module.exports = {
    startMqttBroker
};