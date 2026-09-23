import { useEffect, useState } from "react";

type Telemetry = {
    satellite_id: string;
    student_id: number | null;
    student_name: string | null;
    school_id: number | null;
    school_name: string | null;
    schema_version: number;
    event_time: string;
    altitude_msl: number | null;
    altitude_agl: number | null;
    temperature: number | null;
    humidity: number | null;
    pitch: number | null;
    roll: number | null;
    acceleration: number | null;
    wifi_rssi: number | null;
};

type LatestResponse = {
    success: boolean;
    count: number;
    telemetry: Telemetry[];
};

const API_URL =
    "http://localhost:5000/api/v1/telemetry/latest";

function TelemetryTestDashboard() {
    const [satellites, setSatellites] = useState<Telemetry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState("");

    async function fetchTelemetry() {
        try {
            setError("");

            const response = await fetch(API_URL);

            if (!response.ok) {
                throw new Error(
                    `API request failed: ${response.status}`
                );
            }

            const data: LatestResponse =
                await response.json();

            if (!data.success) {
                throw new Error(
                    "Telemetry API returned an error."
                );
            }

            setSatellites(data.telemetry);

            setLastUpdated(
                new Date().toLocaleTimeString()
            );
        } catch (err) {
            console.error(err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load telemetry."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchTelemetry();

        const interval = setInterval(
            fetchTelemetry,
            2000
        );

        return () => {
            clearInterval(interval);
        };
    }, []);

    return (
        <>
            <style>{`
                .telemetry-page {
                    min-height: 100vh;
                    background: #f5f6f8;
                    padding: 32px;
                    font-family: Arial, Helvetica, sans-serif;
                    color: #1f2937;
                }

                .telemetry-container {
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .telemetry-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 24px;
                    margin-bottom: 24px;
                }

                .telemetry-title {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                }

                .telemetry-subtitle {
                    margin: 8px 0 0;
                    color: #6b7280;
                    font-size: 14px;
                }

                .telemetry-header-right {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 8px;
                }

                .telemetry-count {
                    font-size: 15px;
                }

                .telemetry-updated {
                    font-size: 13px;
                    color: #6b7280;
                }

                .telemetry-refresh {
                    margin-top: 4px;
                    border: 1px solid #d1d5db;
                    background: #ffffff;
                    color: #111827;
                    border-radius: 6px;
                    padding: 8px 14px;
                    font-size: 14px;
                    cursor: pointer;
                }

                .telemetry-refresh:hover {
                    background: #f3f4f6;
                }

                .telemetry-error {
                    margin-bottom: 20px;
                    padding: 14px 16px;
                    border: 1px solid #fecaca;
                    background: #fef2f2;
                    color: #b91c1c;
                    border-radius: 8px;
                }

                .telemetry-loading,
                .telemetry-empty {
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    padding: 32px;
                    text-align: center;
                    color: #6b7280;
                }

                .telemetry-card {
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    overflow: hidden;
                }

                .telemetry-table-wrapper {
                    width: 100%;
                    overflow-x: auto;
                }

                .telemetry-table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 900px;
                }

                .telemetry-table th {
                    background: #f9fafb;
                    color: #4b5563;
                    font-size: 13px;
                    font-weight: 600;
                    text-align: left;
                    padding: 14px 16px;
                    border-bottom: 1px solid #e5e7eb;
                    white-space: nowrap;
                }

                .telemetry-table td {
                    padding: 14px 16px;
                    font-size: 14px;
                    border-bottom: 1px solid #f1f5f9;
                    white-space: nowrap;
                }

                .telemetry-table tbody tr:hover {
                    background: #fafafa;
                }

                .telemetry-table tbody tr:last-child td {
                    border-bottom: none;
                }

                .satellite-id {
                    font-weight: 600;
                }

                @media (max-width: 768px) {
                    .telemetry-page {
                        padding: 16px;
                    }

                    .telemetry-header {
                        flex-direction: column;
                    }

                    .telemetry-header-right {
                        align-items: flex-start;
                    }

                    .telemetry-title {
                        font-size: 22px;
                    }
                }
            `}</style>

            <div className="telemetry-page">
                <div className="telemetry-container">

                    {loading ? (
                        <div className="telemetry-loading">
                            Loading telemetry...
                        </div>
                    ) : (
                        <>
                            <header className="telemetry-header">
                                <div>
                                    <h1 className="telemetry-title">
                                        Satellite Telemetry Test
                                    </h1>

                                    <p className="telemetry-subtitle">
                                        Live data from telemetry backend
                                    </p>
                                </div>

                                <div className="telemetry-header-right">
                                    <div className="telemetry-count">
                                        Satellites:{" "}
                                        <strong>
                                            {satellites.length}
                                        </strong>
                                    </div>

                                    <div className="telemetry-updated">
                                        Last update: {lastUpdated}
                                    </div>

                                    <button
                                        className="telemetry-refresh"
                                        onClick={fetchTelemetry}
                                    >
                                        Refresh
                                    </button>
                                </div>
                            </header>

                            {error && (
                                <div className="telemetry-error">
                                    <strong>Error:</strong>{" "}
                                    {error}
                                </div>
                            )}

                            {satellites.length === 0 ? (
                                <div className="telemetry-empty">
                                    No telemetry available.
                                </div>
                            ) : (
                                <div className="telemetry-card">
                                    <div className="telemetry-table-wrapper">
                                        <table className="telemetry-table">
                                            <thead>
                                                <tr>
                                                    <th>Satellite</th>
                                                    <th>Temperature</th>
                                                    <th>Humidity</th>
                                                    <th>Altitude MSL</th>
                                                    <th>Altitude AGL</th>
                                                    <th>RSSI</th>
                                                    <th>Event Time</th>
                                                    <th>Student</th>
                                                    <th>School</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {satellites.map(
                                                    (satellite) => (
                                                        <tr
                                                            key={
                                                                satellite.satellite_id
                                                            }
                                                        >
                                                            <td className="satellite-id">
                                                                {
                                                                    satellite.satellite_id
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    satellite.temperature
                                                                }{" "}
                                                                °C
                                                            </td>

                                                            <td>
                                                                {
                                                                    satellite.humidity
                                                                }{" "}
                                                                %
                                                            </td>

                                                            <td>
                                                                {
                                                                    satellite.altitude_msl
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    satellite.altitude_agl
                                                                }
                                                            </td>

                                                            <td>
                                                                {
                                                                    satellite.wifi_rssi
                                                                }{" "}
                                                                dBm
                                                            </td>

                                                            <td>
                                                                {
                                                                    satellite.event_time
                                                                }
                                                            </td>
                                                            <td>
                                                                {satellite.student_name ?? "Unassigned"}
                                                            </td>

                                                            <td>
                                                                {satellite.school_name ?? "Unassigned"}
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

export default TelemetryTestDashboard;