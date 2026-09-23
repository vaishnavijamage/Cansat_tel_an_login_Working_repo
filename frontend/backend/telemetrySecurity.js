const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

const telemetryRedis = require("./telemetryRedis");
const { findActiveSatellite } = require("./telemetryStore");

require("dotenv").config();

const FLEET_API_KEY =
    process.env.TELEMETRY_FLEET_API_KEY;

if (!FLEET_API_KEY) {
    throw new Error(
        "TELEMETRY_FLEET_API_KEY is not configured."
    );
}

const AUTH_CACHE_TTL_MS =
    Number(process.env.TELEMETRY_AUTH_CACHE_TTL_MS) || 30000;

const RATE_LIMIT_WINDOW_MS =
    Number(process.env.TELEMETRY_RATE_LIMIT_WINDOW_MS) || 1000;

const RATE_LIMIT_MAX =
    Number(process.env.TELEMETRY_RATE_LIMIT_MAX) || 10;

const RATE_LIMIT_PREFIX =
    process.env.TELEMETRY_RATE_LIMIT_PREFIX ||
    "telemetry:ratelimit:";

const satelliteCache = new Map();

let rateLimitRedis = null;
let satelliteRateLimiter = null;
let rateLimiterInitPromise = null;


function safeSecretCompare(provided, expected) {
    const providedBuffer = Buffer.from(
        String(provided),
        "utf8"
    );

    const expectedBuffer = Buffer.from(
        String(expected),
        "utf8"
    );

    if (
        providedBuffer.length !==
        expectedBuffer.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        providedBuffer,
        expectedBuffer
    );
}


async function getCachedSatellite(
    satelliteId
) {
    const now = Date.now();

    const cached =
        satelliteCache.get(satelliteId);

    if (
        cached &&
        cached.expiresAt > now
    ) {
        return cached.satellite;
    }

    const satellite =
        await findActiveSatellite(
            satelliteId
        );

    satelliteCache.set(satelliteId, {
        satellite: satellite || null,
        expiresAt:
            now + AUTH_CACHE_TTL_MS,
    });

    return satellite;
}


async function authenticateSatellite(
    req,
    res,
    next
) {
    try {
        const satelliteId =
            req.get("X-Satellite-ID")?.trim();

        const authorization =
            req.get("Authorization")?.trim();

        if (!satelliteId) {
            return res.status(401).json({
                success: false,
                message:
                    "Satellite authentication required.",
            });
        }

        if (
            !/^[A-Za-z0-9_-]{1,50}$/.test(
                satelliteId
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid satellite identity.",
            });
        }

        if (
            !authorization ||
            !authorization.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Satellite authentication required.",
            });
        }

        const suppliedKey =
            authorization.slice(7).trim();

        if (!suppliedKey) {
            return res.status(401).json({
                success: false,
                message:
                    "Satellite authentication required.",
            });
        }

        if (
            !safeSecretCompare(
                suppliedKey,
                FLEET_API_KEY
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid satellite credentials.",
            });
        }

        const satellite =
            await getCachedSatellite(
                satelliteId
            );

        if (
            !satellite ||
            !satellite.is_active
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid satellite credentials.",
            });
        }

        req.telemetrySatelliteId =
            satellite.satellite_id;

        req.telemetrySatellite =
            satellite;

        next();
    } catch (error) {
        console.error(
            "Telemetry authentication error:",
            error
        );

        return res.status(503).json({
            success: false,
            message:
                "Telemetry authentication temporarily unavailable.",
        });
    }
}


async function initializeTelemetrySecurity() {
    if (satelliteRateLimiter) {
        return satelliteRateLimiter;
    }

    if (rateLimiterInitPromise) {
        return rateLimiterInitPromise;
    }

    rateLimiterInitPromise = (async () => {
        const redisClient =
            telemetryRedis.duplicate();

        redisClient.on(
            "error",
            (error) => {
                console.error(
                    "Telemetry rate-limit Redis error:",
                    error
                );
            }
        );

        await redisClient.connect();

        const limiter =
            rateLimit({
                windowMs:
                    RATE_LIMIT_WINDOW_MS,

                limit:
                    RATE_LIMIT_MAX,

                standardHeaders:
                    "draft-8",

                legacyHeaders:
                    false,

                passOnStoreError:
                    false,

                keyGenerator:
                    (req) =>
                        `satellite:${req.telemetrySatelliteId}`,

                store:
                    new RedisStore({
                        prefix:
                            RATE_LIMIT_PREFIX,

                        sendCommand:
                            (...args) =>
                                redisClient.sendCommand(
                                    args
                                ),
                    }),

                handler:
                    (req, res) => {
                        return res
                            .status(429)
                            .json({
                                success: false,
                                message:
                                    "Satellite telemetry rate limit exceeded.",
                            });
                    },
            });

        rateLimitRedis =
            redisClient;

        satelliteRateLimiter =
            limiter;

        console.log(
            `Telemetry security ready: ${RATE_LIMIT_MAX} requests/${RATE_LIMIT_WINDOW_MS}ms per satellite.`
        );

        return limiter;
    })();

    try {
        return await rateLimiterInitPromise;
    } catch (error) {
        rateLimiterInitPromise = null;

        if (
            rateLimitRedis &&
            rateLimitRedis.isOpen
        ) {
            try {
                await rateLimitRedis.quit();
            } catch {
                // Ignore Redis cleanup errors.
            }
        }

        rateLimitRedis = null;

        throw error;
    }
}

function invalidateSatelliteAuthCache(
    satelliteId
) {
    satelliteCache.delete(
        satelliteId
    );
}


module.exports = {
    authenticateSatellite,
    initializeTelemetrySecurity,
    invalidateSatelliteAuthCache,
};