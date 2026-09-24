const express = require("express");
const telemetryPool = require("./telemetryDatabase");

const {
    requireAuth,
    requireStudent,
} = require("./authMiddleware");

const {
    findStudentById,
    findActiveSatelliteOwners,
    findActiveSatelliteOwnerBySatelliteId,
} = require("./userRepository");

const {
    getAllLatestTelemetry,
    getLatestTelemetry,
} = require("./telemetryLatest");

const router = express.Router();

/*
 * Remove internal backend fields before returning
 * telemetry to frontend clients.
 *
 * packet_hash:
 *   Used internally for duplicate detection.
 *
 * received_at:
 *   Internal server-side ingestion timestamp.
 */

function sanitizeTelemetry(packet) {
    if (!packet) {
        return null;
    }

    const publicTelemetry = {
        ...packet,
    };

    delete publicTelemetry.packet_hash;
    delete publicTelemetry.received_at;

    return publicTelemetry;
}

/*
 * Common telemetry dashboard
 *
 * Returns the latest telemetry for all satellites.
 */
router.get("/latest", requireAuth, async (req, res) => {
    try {
        const [telemetry, owners] =
            await Promise.all([
                getAllLatestTelemetry(),
                findActiveSatelliteOwners(),
            ]);


        let visibleOwners = owners;

        if (req.user.type === "school") {
            visibleOwners = owners.filter(
                (owner) =>
                    owner.school_id === req.user.id
            );
        }

        if (req.user.type === "student") {
            visibleOwners = owners.filter(
                (owner) =>
                    owner.student_id === req.user.id
            );
        }

        const ownerMap = new Map(
            visibleOwners.map((owner) => [
                owner.satellite_id,
                owner,
            ])
        );

        const enrichedTelemetry =
            telemetry
                .filter((packet) =>
                    ownerMap.has(packet.satellite_id)
                )
                .map((packet) => {
                    const owner =
                        ownerMap.get(packet.satellite_id);

                    return {
                        ...sanitizeTelemetry(packet),

                        student_id:
                            owner?.student_id ?? null,

                        student_name:
                            owner?.student_name ?? null,

                        school_id:
                            owner?.school_id ?? null,

                        school_name:
                            owner?.school_name ?? null,
                    };
                });

        return res.status(200).json({
            success: true,
            count: enrichedTelemetry.length,
            telemetry: enrichedTelemetry,
        });
    } catch (error) {
        console.error(
            "Latest telemetry request failed:",
            error
        );

        return res.status(503).json({
            success: false,
            message:
                "Latest telemetry is temporarily unavailable.",
        });
    }
});


/*
 * Logged-in student telemetry
 *
 * The student cannot choose the satellite ID.
 * The backend gets the assigned satellite ID
 * from the authenticated student account.
 */
router.get(
    "/student",
    requireAuth,
    requireStudent,
    async (req, res) => {
        try {
            const student =
                await findStudentById(
                    req.user.id
                );

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Student account not found.",
                });
            }

            if (!student.is_active) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Student account is inactive.",
                });
            }

            const satelliteId =
                student.satellite_id?.trim();

            if (!satelliteId) {
                return res.status(404).json({
                    success: false,
                    message:
                        "No satellite is assigned to this student.",
                });
            }

            const telemetry =
                await getLatestTelemetry(
                    satelliteId
                );

            if (!telemetry) {
                return res.status(404).json({
                    success: false,
                    message:
                        "No telemetry is currently available for the assigned satellite.",
                });
            }

            return res.status(200).json({
                success: true,
                satelliteId,
                telemetry:
                    sanitizeTelemetry(
                        telemetry
                    ),
            });
        } catch (error) {
            console.error(
                "Student telemetry request failed:",
                error
            );

            return res.status(503).json({
                success: false,
                message:
                    "Student telemetry is temporarily unavailable.",
            });
        }
    }
);


/*
 * Historical telemetry for one satellite.
 *
 * Query parameters:
 *   from  = optional UTC ISO-8601 timestamp
 *   to    = optional UTC ISO-8601 timestamp
 *   limit = optional, maximum 500 records
 */
router.get(
    "/history/:satelliteId",
    requireAuth,
    async (req, res) => {
        try {
            const satelliteId =
                req.params.satelliteId?.trim();

            if (
                !satelliteId ||
                !/^[A-Za-z0-9_-]{1,50}$/.test(
                    satelliteId
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid satellite ID.",
                });
            }

            const owner =
                await findActiveSatelliteOwnerBySatelliteId(
                    satelliteId
                );

            if (!owner) {
                return res.status(404).json({
                    success: false,
                    message: "Satellite not found.",
                });
            }

            if (
                req.user.type === "student" &&
                owner.student_id !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied.",
                });
            }

            if (
                req.user.type === "school" &&
                owner.school_id !== req.user.id
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied.",
                });
            }

            const from =
                req.query.from?.trim() || null;

            const to =
                req.query.to?.trim() || null;

            let limit =
                Number(req.query.limit) || 100;

            if (
                !Number.isInteger(limit) ||
                limit < 1 ||
                limit > 500
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Limit must be between 1 and 500.",
                });
            }

            const where = [
                "satellite_id = ?",
            ];

            const values = [
                satelliteId,
            ];

            if (from) {
                const fromDate =
                    new Date(from);

                if (
                    Number.isNaN(
                        fromDate.getTime()
                    )
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Invalid 'from' timestamp.",
                    });
                }

                where.push(
                    "event_time >= ?"
                );

                values.push(
                    fromDate
                        .toISOString()
                        .replace("T", " ")
                        .replace("Z", "")
                );
            }

            if (to) {
                const toDate =
                    new Date(to);

                if (
                    Number.isNaN(
                        toDate.getTime()
                    )
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Invalid 'to' timestamp.",
                    });
                }

                where.push(
                    "event_time <= ?"
                );

                values.push(
                    toDate
                        .toISOString()
                        .replace("T", " ")
                        .replace("Z", "")
                );
            }

            values.push(limit);

            const [rows] =
                await telemetryPool.execute(
                    `
                    SELECT
                        event_time,
                        satellite_id,
                        schema_version,
                        altitude_msl,
                        altitude_agl,
                        temperature,
                        humidity,
                        pitch,
                        roll,
                        acceleration,
                        wifi_rssi
                    FROM telemetry_packets
                    WHERE ${where.join(" AND ")}
                    ORDER BY event_time DESC
                    LIMIT ?
                    `,
                    values
                );

            return res.status(200).json({
                success: true,
                satelliteId,
                count: rows.length,
                telemetry: rows,
            });
        } catch (error) {
            console.error(
                "Telemetry history request failed:",
                error
            );

            return res.status(503).json({
                success: false,
                message:
                    "Telemetry history is temporarily unavailable.",
            });
        }
    }
);

module.exports = router;