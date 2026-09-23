const os = require("os");

const {
    updateLatestTelemetryBatch,
} = require("./telemetryLatest");

require("dotenv").config();

const telemetryRedis = require("./telemetryRedis");

const {
    STREAM_NAME,
    GROUP_NAME,
    ensureTelemetryQueue,
} = require("./telemetryQueue");

const {
    saveTelemetryBatch,
} = require("./telemetryStore");


const WORKER_NAME =
    process.env.TELEMETRY_WORKER_NAME ||
    `${os.hostname()}-${process.pid}`;

const BATCH_SIZE =
    Number(process.env.TELEMETRY_WORKER_BATCH_SIZE) || 200;

const BLOCK_MS =
    Number(process.env.TELEMETRY_WORKER_BLOCK_MS) || 1000;

const CLAIM_IDLE_MS =
    Number(process.env.TELEMETRY_WORKER_CLAIM_IDLE_MS) || 60000;

const RECOVERY_INTERVAL_MS =
    Number(process.env.TELEMETRY_WORKER_RECOVERY_MS) || 10000;


let blockingRedis = null;
let shuttingDown = false;
let recoveryRunning = false;


/*
 * Convert Redis Stream entries into a simple structure.
 */
function normalizeEntries(result) {
    if (!result || !Array.isArray(result)) {
        return [];
    }

    const stream = result.find(
        (item) => item.name === STREAM_NAME
    );

    if (!stream || !Array.isArray(stream.messages)) {
        return [];
    }

    return stream.messages.map((entry) => ({
        id: String(entry.id),
        fields: entry.message,
    }));
}


/*
 * Convert Redis stream payloads into telemetry packets.
 */
function parseEntries(entries) {
    return entries.map((entry) => {
        if (!entry.fields?.payload) {
            throw new Error(
                `Telemetry stream entry ${entry.id} has no payload.`
            );
        }

        let packet;

        try {
            packet = JSON.parse(entry.fields.payload);
        } catch {
            throw new Error(
                `Invalid JSON in telemetry stream entry ${entry.id}.`
            );
        }

        return {
            streamId: entry.id,
            packet,
        };
    });
}


/*
 * Save a batch and acknowledge only after MySQL
 * successfully commits the transaction.
 */
async function processEntries(entries) {
    if (entries.length === 0) {
        return;
    }

    const parsed = parseEntries(entries);

    const packets = parsed.map(
        ({ packet }) => packet
    );

    /*
     * MySQL is the permanent storage.
     *
     * If this throws, we DO NOT ACK Redis messages.
     * They therefore remain pending and can be retried.
     */
    await saveTelemetryBatch(packets);

    /*
     * Update Redis latest-state only after MySQL
     * has successfully committed.
     *
     * If this fails, the Redis messages are NOT
     * acknowledged and can be retried safely.
     */
    await updateLatestTelemetryBatch(packets);

    const streamIds = parsed.map(
        ({ streamId }) => streamId
    );

    await telemetryRedis.xAck(
        STREAM_NAME,
        GROUP_NAME,
        streamIds
    );

    console.log(
        `Processed and acknowledged ${streamIds.length} telemetry packets.`
    );
}


/*
 * Recover messages that were left pending by
 * a crashed or unavailable worker.
 */
async function recoverPendingMessages() {
    if (recoveryRunning || shuttingDown) {
        return;
    }

    recoveryRunning = true;

    try {
        let cursor = "0-0";

        while (!shuttingDown) {
            const result = await telemetryRedis.xAutoClaim(
                STREAM_NAME,
                GROUP_NAME,
                WORKER_NAME,
                CLAIM_IDLE_MS,
                cursor,
                {
                    COUNT: BATCH_SIZE,
                }
            );

            const entries = normalizeEntries([
                {
                    name: STREAM_NAME,
                    messages: result.messages || [],
                },
            ]);

            if (entries.length > 0) {
                await processEntries(entries);
            }

            /*
             * Redis returns the next cursor for scanning
             * the Pending Entries List.
             */
            cursor = String(
                result.nextId || "0-0"
            );

            if (cursor === "0-0") {
                break;
            }
        }
    } catch (error) {
        console.error(
            "Telemetry pending-message recovery error:",
            error
        );
    } finally {
        recoveryRunning = false;
    }
}


/*
 * Continuously consume new telemetry.
 */
async function consumeTelemetry() {
    while (!shuttingDown) {
        try {
            const result =
                await blockingRedis.xReadGroup(
                    GROUP_NAME,
                    WORKER_NAME,
                    [
                        {
                            key: STREAM_NAME,
                            id: ">",
                        },
                    ],
                    {
                        COUNT: BATCH_SIZE,
                        BLOCK: BLOCK_MS,
                    }
                );

            if (!result) {
                continue;
            }

            const entries =
                normalizeEntries(result);

            if (entries.length > 0) {
                await processEntries(entries);
            }
        } catch (error) {
            if (shuttingDown) {
                break;
            }

            console.error(
                "Telemetry worker processing error:",
                error
            );

            /*
             * Do not acknowledge anything after a failure.
             * Redis keeps the messages pending.
             */
            await new Promise(
                (resolve) =>
                    setTimeout(resolve, 2000)
            );
        }
    }
}


/*
 * Start the worker.
 */
async function startWorker() {
    console.log(
        `Starting telemetry worker: ${WORKER_NAME}`
    );

    await ensureTelemetryQueue();

    blockingRedis =
        telemetryRedis.duplicate();

    blockingRedis.on(
        "error",
        (error) => {
            console.error(
                "Telemetry worker Redis connection error:",
                error
            );
        }
    );

    await blockingRedis.connect();

    /*
     * Recover any messages left behind by a previous
     * worker before consuming new messages.
     */
    await recoverPendingMessages();

    console.log(
        "Telemetry worker is ready."
    );

    /*
     * Periodically recover abandoned messages.
     */
    const recoveryTimer =
        setInterval(
            recoverPendingMessages,
            RECOVERY_INTERVAL_MS
        );

    try {
        await consumeTelemetry();
    } finally {
        clearInterval(recoveryTimer);
    }
}


/*
 * Graceful shutdown.
 */
async function shutdown(signal) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log(
        `Telemetry worker shutting down (${signal})...`
    );

    try {
        if (
            blockingRedis &&
            blockingRedis.isOpen
        ) {
            await blockingRedis.quit();
        }
    } catch (error) {
        console.error(
            "Error closing worker Redis connection:",
            error
        );
    }

    try {
        if (
            telemetryRedis.isOpen
        ) {
            await telemetryRedis.quit();
        }
    } catch (error) {
        console.error(
            "Error closing Redis connection:",
            error
        );
    }

    console.log(
        "Telemetry worker stopped."
    );

    process.exit(0);
}


process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);


startWorker().catch(
    (error) => {
        console.error(
            "Fatal telemetry worker error:",
            error
        );

        process.exit(1);
    }
);