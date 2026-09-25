const telemetryPool = require("./telemetryDatabase");

/*
 * Find a registered and active satellite.
 *
 * Returns:
 *   satellite object when found
 *   null when not found
 */
async function createSatellite(satelliteId) {
    const [result] = await telemetryPool.execute(
        `
        INSERT INTO satellites (
            satellite_id,
            is_active
        )
        VALUES (?, TRUE)
        `,
        [satelliteId]
    );

    return result;
}

async function deactivateSatellite(satelliteId) {
    const [result] = await telemetryPool.execute(
        `
        UPDATE satellites
        SET is_active = FALSE
        WHERE satellite_id = ?
        `,
        [satelliteId]
    );

    return result.affectedRows > 0;
}

async function findActiveSatellite(satelliteId) {
    const [rows] = await telemetryPool.execute(
        `
        SELECT
            satellite_id,
            is_active,
            last_seen_at
        FROM satellites
       WHERE satellite_id = ?
       AND is_active = TRUE
       LIMIT 1
        `,
        [satelliteId]
    );

    return rows[0] || null;
}
async function saveTelemetryBatch(packets) {
    if (
        !Array.isArray(packets) ||
        packets.length === 0
    ) {
        return 0;
    }

    const connection =
        await telemetryPool.getConnection();

    try {
        await connection.beginTransaction();

        const placeholders = packets
            .map(
                () =>
                    "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .join(", ");

        const values = [];

        for (const packet of packets) {
            values.push(
                packet.event_time,
                packet.satellite_id,
                packet.packet_hash,
                packet.schema_version,
                packet.received_at,
                packet.altitude_msl ?? null,
                packet.altitude_agl ?? null,
                packet.temperature ?? null,
                packet.humidity ?? null,
                packet.pitch ?? null,
                packet.roll ?? null,
                packet.acceleration ?? null,
                packet.wifi_rssi ?? null
            );
        }

        await connection.execute(
            `
            INSERT INTO telemetry_packets (
                event_time,
                satellite_id,
                packet_hash,
                schema_version,
                received_at,
                altitude_msl,
                altitude_agl,
                temperature,
                humidity,
                pitch,
                roll,
                acceleration,
                wifi_rssi
            )
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE
                packet_hash = packet_hash
            `,
            values
        );

        await connection.commit();

        return packets.length;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    findActiveSatellite,
    saveTelemetryBatch,
    createSatellite,
    deactivateSatellite,
};