const { createSatellite } = require("./telemetryStore");
const telemetryPool = require("./telemetryDatabase");

async function main() {
    const satelliteId = process.argv[2]?.trim();

    if (!satelliteId) {
        throw new Error(
            "Usage: node registerSatellite.js SAT-0001"
        );
    }

    if (!/^[A-Za-z0-9_-]{1,50}$/.test(satelliteId)) {
        throw new Error("Invalid satellite ID.");
    }

    try {
        await createSatellite(satelliteId);

        console.log(
            `Satellite ${satelliteId} registered successfully.`
        );
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            console.error(
                `Satellite ${satelliteId} is already registered.`
            );
            process.exitCode = 1;
            return;
        }

        throw error;
    } finally {
        await telemetryPool.end();
    }
}

main().catch((error) => {
    console.error("Satellite registration failed:");
    console.error(error.message);
    process.exit(1);
});