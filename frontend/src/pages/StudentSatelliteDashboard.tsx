import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    Activity,
    CheckCircle2,
    Clock3,
    Download,
    Droplets,
    Gauge,
    History,
    RefreshCw,
    Satellite,
    Thermometer,
    WifiOff,
    X,
} from "lucide-react";

const API_BASE_URL = (
    import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

/*
 * Satellite status:
 *
 * Online  -> latest telemetry is 5 minutes old or newer
 * Offline -> latest telemetry is older than 5 minutes
 */
const OFFLINE_AFTER_MS = 5 * 60 * 1000;

const REFRESH_INTERVAL_MS = 30_000;

type StudentTelemetry = {
    satellite_id: string;
    schema_version?: number;

    event_time: string;
    received_at?: string | null;

    altitude_msl?: number | null;
    altitude_agl?: number | null;

    temperature?: number | null;
    humidity?: number | null;
    pitch?: number | null;
};

type StudentTelemetryResponse = {
    success: boolean;
    satelliteId: string;
    telemetry: StudentTelemetry | null;
    message?: string;
};

type HistoryResponse = {
    success: boolean;
    satelliteId?: string;
    telemetry?: StudentTelemetry[];
    data?: StudentTelemetry[];
    history?: StudentTelemetry[];
    message?: string;
};

type StudentSatellite = {
    id: string;

    altitudeMsl: number | null;
    altitudeAgl: number | null;

    temperature: number | null;
    humidity: number | null;
    pitch: number | null;

    eventTime: string;
    receivedAt: string | null;
};

type NodeStatus =
    | "online"
    | "offline"
    | "unknown";

type HistoryState = {
    loading: boolean;
    loaded: boolean;
    error: string | null;
    records: StudentSatellite[];
};

/* ============================================================
   HELPERS
============================================================ */

function toNumber(
    value: unknown
): number | null {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function formatNumber(
    value: number | null,
    unit = "",
    decimals = 1
): string {
    if (value === null) {
        return "—";
    }

    return `${value.toFixed(decimals)}${unit}`;
}

/*
 * Handles the MySQL datetime format currently returned
 * by your backend:
 *
 * 2026-09-24 19:07:44.000
 */
function parseServerDate(
    value: string | null
): Date | null {
    if (!value) {
        return null;
    }

    const normalized =
        value.includes("T")
            ? value
            : value.replace(" ", "T");

    const date = new Date(normalized);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date;
}

function formatDate(
    value: string | null
): string {
    if (!value) {
        return "Not available";
    }

    const date =
        parseServerDate(value);

    if (!date) {
        return value;
    }

    return date.toLocaleString();
}

function normalizeTelemetry(
    telemetry: StudentTelemetry,
    fallbackSatelliteId?: string
): StudentSatellite {
    return {
        id:
            fallbackSatelliteId ||
            telemetry.satellite_id,

        altitudeMsl:
            toNumber(
                telemetry.altitude_msl
            ),

        altitudeAgl:
            toNumber(
                telemetry.altitude_agl
            ),

        temperature:
            toNumber(
                telemetry.temperature
            ),

        humidity:
            toNumber(
                telemetry.humidity
            ),

        pitch:
            toNumber(
                telemetry.pitch
            ),

        eventTime:
            telemetry.event_time,

        receivedAt:
            telemetry.received_at ??
            null,
    };
}

function getNodeStatus(
    satellite: StudentSatellite | null
): NodeStatus {
    if (!satellite) {
        return "unknown";
    }

    /*
     * received_at is preferred because it tells us when the
     * backend actually received the telemetry.
     *
     * event_time is used when received_at is unavailable.
     */
    const timestamp =
        satellite.receivedAt ||
        satellite.eventTime;

    const date =
        parseServerDate(timestamp);

    if (!date) {
        return "unknown";
    }

    const age =
        Date.now() -
        date.getTime();

    /*
     * Protect against clock differences where the telemetry
     * timestamp is slightly in the future.
     */
    if (age < 0) {
        return "online";
    }

    return age <= OFFLINE_AFTER_MS
        ? "online"
        : "offline";
}

/* ============================================================
   CSV
============================================================ */

function createCSV(
    records: StudentSatellite[]
): string {
    const rows = [
        [
            "Satellite ID",
            "Event Time",
            "Received At",
            "Altitude MSL",
            "Altitude AGL",
            "Temperature",
            "Humidity",
            "Pitch",
        ],
    ];

    for (const record of records) {
        rows.push([
            record.id,
            record.eventTime,
            record.receivedAt ?? "",
            record.altitudeMsl != null ? String(record.altitudeMsl) : "",
            record.altitudeAgl != null ? String(record.altitudeAgl) : "",
            record.temperature != null ? String(record.temperature) : "",
            record.humidity != null ? String(record.humidity) : "",
            record.pitch != null ? String(record.pitch) : "",
        ]);
    }

    return rows
        .map((row) =>
            row
                .map(
                    (value) =>
                        `"${String(
                            value
                        ).replace(
                            /"/g,
                            '""'
                        )}"`
                )
                .join(",")
        )
        .join("\n");
}

function downloadCSV(
    records: StudentSatellite[],
    filename: string
): void {
    const csv =
        createCSV(records);

    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;",
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href = url;
    link.download = filename;

    document.body.appendChild(
        link
    );

    link.click();

    document.body.removeChild(
        link
    );

    URL.revokeObjectURL(
        url
    );
}

/* ============================================================
   COMPONENT
============================================================ */

export default function StudentSatelliteDashboard() {
    const [
        satellite,
        setSatellite,
    ] = useState<StudentSatellite | null>(
        null
    );

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        refreshing,
        setRefreshing,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState<string | null>(
        null
    );

    const [
        lastUpdated,
        setLastUpdated,
    ] = useState<Date | null>(
        null
    );

    const [
        currentTime,
        setCurrentTime,
    ] = useState(
        Date.now()
    );

    const [
        showHistory,
        setShowHistory,
    ] = useState(false);

    const [
        history,
        setHistory,
    ] = useState<HistoryState>({
        loading: false,
        loaded: false,
        error: null,
        records: [],
    });

    /* ========================================================
       CURRENT TELEMETRY
    ======================================================== */

    const loadTelemetry =
        useCallback(
            async () => {
                try {
                    setError(null);

                    const response =
                        await fetch(
                            `${API_BASE_URL}/api/v1/telemetry/student`,
                            {
                                method:
                                    "GET",

                                credentials:
                                    "include",

                                headers: {
                                    Accept:
                                        "application/json",
                                },

                                cache:
                                    "no-store",
                            }
                        );

                    let data:
                        StudentTelemetryResponse;

                    try {
                        data =
                            await response.json();
                    } catch {
                        throw new Error(
                            "The server returned an invalid response."
                        );
                    }

                    if (
                        !response.ok ||
                        !data.success
                    ) {
                        throw new Error(
                            data.message ||
                            "Unable to load satellite telemetry."
                        );
                    }

                    if (
                        !data.telemetry
                    ) {
                        throw new Error(
                            "No telemetry is currently available."
                        );
                    }

                    const normalized =
                        normalizeTelemetry(
                            data.telemetry,
                            data.satelliteId
                        );

                    setSatellite(
                        normalized
                    );

                    setLastUpdated(
                        new Date()
                    );

                    /*
                     * If the assigned satellite changes, clear
                     * previously loaded history.
                     */
                    setHistory({
                        loading:
                            false,
                        loaded:
                            false,
                        error:
                            null,
                        records:
                            [],
                    });
                } catch (
                requestError
                ) {
                    const message =
                        requestError instanceof
                            Error
                            ? requestError.message
                            : "Unable to load satellite telemetry.";

                    setError(
                        message
                    );
                } finally {
                    setLoading(
                        false
                    );

                    setRefreshing(
                        false
                    );
                }
            },
            []
        );

    /* ========================================================
       AUTOMATIC REFRESH
    ======================================================== */

    useEffect(() => {
        loadTelemetry();

        const interval =
            window.setInterval(
                loadTelemetry,
                REFRESH_INTERVAL_MS
            );

        return () => {
            window.clearInterval(
                interval
            );
        };
    }, [
        loadTelemetry,
    ]);

    /*
     * Refresh the local clock every 10 seconds so the
     * 5-minute Online/Offline status updates automatically.
     */
    useEffect(() => {
        const interval =
            window.setInterval(
                () => {
                    setCurrentTime(
                        Date.now()
                    );
                },
                10_000
            );

        return () => {
            window.clearInterval(
                interval
            );
        };
    }, []);

    /* ========================================================
       HISTORY
    ======================================================== */

    const loadHistory =
        useCallback(
            async () => {
                if (
                    !satellite?.id
                ) {
                    return;
                }

                setHistory(
                    (previous) => ({
                        ...previous,
                        loading:
                            true,
                        error:
                            null,
                    })
                );

                try {
                    const response =
                        await fetch(
                            `${API_BASE_URL}/api/v1/telemetry/history/${encodeURIComponent(
                                satellite.id
                            )}`,
                            {
                                method:
                                    "GET",

                                credentials:
                                    "include",

                                headers: {
                                    Accept:
                                        "application/json",
                                },

                                cache:
                                    "no-store",
                            }
                        );

                    let data:
                        HistoryResponse;

                    try {
                        data =
                            await response.json();
                    } catch {
                        throw new Error(
                            "The server returned an invalid history response."
                        );
                    }

                    if (
                        !response.ok ||
                        !data.success
                    ) {
                        throw new Error(
                            data.message ||
                            "Unable to load historical telemetry."
                        );
                    }

                    /*
                     * Supports the backend response as:
                     *
                     * { telemetry: [...] }
                     * { data: [...] }
                     * { history: [...] }
                     */
                    const rawRecords =
                        data.telemetry ??
                        data.data ??
                        data.history ??
                        [];

                    if (
                        !Array.isArray(
                            rawRecords
                        )
                    ) {
                        throw new Error(
                            "Historical telemetry format is invalid."
                        );
                    }

                    const records =
                        rawRecords
                            .filter(
                                (
                                    item
                                ) =>
                                    item &&
                                    typeof item.event_time ===
                                    "string"
                            )
                            .map(
                                (
                                    item
                                ) =>
                                    normalizeTelemetry(
                                        item,
                                        satellite.id
                                    )
                            );

                    setHistory({
                        loading:
                            false,
                        loaded:
                            true,
                        error:
                            null,
                        records,
                    });
                } catch (
                historyError
                ) {
                    const message =
                        historyError instanceof
                            Error
                            ? historyError.message
                            : "Unable to load historical telemetry.";

                    setHistory({
                        loading:
                            false,
                        loaded:
                            false,
                        error:
                            message,
                        records:
                            [],
                    });
                }
            },
            [satellite]
        );

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        void loadTelemetry();
    }, [loadTelemetry]);

    const handleHistory =
        async () => {
            if (
                showHistory
            ) {
                setShowHistory(
                    false
                );

                return;
            }

            setShowHistory(
                true
            );

            if (
                !history.loaded &&
                !history.loading
            ) {
                await loadHistory();
            }
        };

    /* ========================================================
       STATUS
    ======================================================== */

    const nodeStatus =
        useMemo(
            () =>
                getNodeStatus(
                    satellite
                ),
            [
                satellite,
                currentTime,
            ]
        );

    const statusText =
        nodeStatus ===
            "online"
            ? "Node Online"
            : nodeStatus ===
                "offline"
                ? "Node Offline"
                : "Status Unknown";

    const statusDescription =
        nodeStatus ===
            "online"
            ? "Telemetry has been received within the last 5 minutes."
            : nodeStatus ===
                "offline"
                ? "No telemetry has been received in the last 5 minutes."
                : "A valid telemetry timestamp is not available.";

    /* ========================================================
       LOADING
    ======================================================== */

    if (loading) {
        return (
            <>
                <style>
                    {dashboardStyles}
                </style>

                <section className="student-dashboard">
                    <div className="student-loading">
                        <RefreshCw
                            size={24}
                            className="student-spin"
                        />

                        <div>
                            <strong>
                                Loading your satellite
                            </strong>

                            <p>
                                Getting the latest
                                telemetry...
                            </p>
                        </div>
                    </div>
                </section>
            </>
        );
    }

    /* ========================================================
       UI
    ======================================================== */

    return (
        <>
            <style>
                {dashboardStyles}
            </style>

            <section className="student-dashboard">

                {/* ==================================================
                    HEADER
                ================================================== */}


                {/* ==================================================
                    ERROR
                ================================================== */}

                {error && (
                    <div className="student-error">
                        <div>
                            <strong>
                                Unable to update telemetry
                            </strong>

                            <p>
                                {error}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setRefreshing(
                                    true
                                );

                                loadTelemetry();
                            }}
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* ==================================================
                    ASSIGNED SATELLITE
                ================================================== */}

                <section className="student-assigned-card">
                    <div className="student-satellite-icon">
                        <Satellite
                            size={25}
                        />
                    </div>

                    <div className="student-assigned-content">
                        <span>
                            YOUR ASSIGNED SATELLITE
                        </span>

                        <strong>
                            {satellite?.id ||
                                "Not available"}
                        </strong>

                        <p>
                            Telemetry from your
                            assigned satellite.
                        </p>
                    </div>
                </section>

                {/* ==================================================
                    CURRENT TELEMETRY
                ================================================== */}

                <section className="student-section">
                    <div className="student-section-heading">
                        <div>
                            <h3>
                                Current Telemetry
                            </h3>

                            <p>
                                Latest measurements from
                                your satellite.
                            </p>
                        </div>

                        {satellite && (
                            <button
                                type="button"
                                className="student-download-button"
                                onClick={() =>
                                    downloadCSV(
                                        [
                                            satellite,
                                        ],
                                        `${satellite.id}-latest-telemetry.csv`
                                    )
                                }
                            >
                                <Download
                                    size={16}
                                />

                                Download
                            </button>
                        )}
                    </div>

                    <div className="student-telemetry-grid">
                        <TelemetryCard
                            icon={
                                <Thermometer
                                    size={21}
                                />
                            }
                            label="Temperature"
                            value={formatNumber(
                                satellite?.temperature ??
                                null,
                                " °C"
                            )}
                            description="Air temperature"
                            type="temperature"
                        />

                        <TelemetryCard
                            icon={
                                <Droplets
                                    size={21}
                                />
                            }
                            label="Humidity"
                            value={formatNumber(
                                satellite?.humidity ??
                                null,
                                " %"
                            )}
                            description="Relative humidity"
                            type="humidity"
                        />

                        <TelemetryCard
                            icon={
                                <Gauge
                                    size={21}
                                />
                            }
                            label="Altitude MSL"
                            value={formatNumber(
                                satellite?.altitudeMsl ??
                                null,
                                " m"
                            )}
                            description="Above mean sea level"
                            type="altitude"
                        />

                        <TelemetryCard
                            icon={
                                <Gauge
                                    size={21}
                                />
                            }
                            label="Altitude AGL"
                            value={formatNumber(
                                satellite?.altitudeAgl ??
                                null,
                                " m"
                            )}
                            description="Above ground level"
                            type="altitude"
                        />

                        <TelemetryCard
                            icon={
                                <Activity
                                    size={21}
                                />
                            }
                            label="Pitch"
                            value={formatNumber(
                                satellite?.pitch ??
                                null,
                                "°"
                            )}
                            description="Satellite orientation"
                            type="pitch"
                        />
                    </div>
                </section>

                {/* ==================================================
                    INFORMATION + CONNECTION STATUS
                ================================================== */}

                <div className="student-main-grid">

                    {/* Latest Update */}

                    <section className="student-card">
                        <div className="student-card-header">
                            <div className="student-card-title">
                                <div className="student-card-icon">
                                    <Clock3
                                        size={19}
                                    />
                                </div>

                                <div>
                                    <h3>
                                        Latest Update
                                    </h3>

                                    <p>
                                        Information about
                                        the latest reading.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                className={
                                    showHistory
                                        ? "student-history-button active"
                                        : "student-history-button"
                                }
                                onClick={
                                    handleHistory
                                }
                                disabled={
                                    !satellite
                                }
                            >
                                {showHistory ? (
                                    <X
                                        size={16}
                                    />
                                ) : (
                                    <History
                                        size={16}
                                    />
                                )}

                                {showHistory
                                    ? "Close History"
                                    : "View History"}
                            </button>
                        </div>

                        <div className="student-info-list">
                            <InfoRow
                                label="Satellite ID"
                                value={
                                    satellite?.id ||
                                    "—"
                                }
                            />

                            <InfoRow
                                label="Telemetry time"
                                value={formatDate(
                                    satellite?.eventTime ||
                                    null
                                )}
                            />

                            <InfoRow
                                label="Server received"
                                value={formatDate(
                                    satellite?.receivedAt ||
                                    null
                                )}
                            />
                        </div>
                    </section>

                    {/* Connection Status */}

                    <section className="student-card">
                        <div className="student-card-header">
                            <div className="student-card-title">
                                <div
                                    className={
                                        nodeStatus ===
                                            "online"
                                            ? "student-card-icon online"
                                            : nodeStatus ===
                                                "offline"
                                                ? "student-card-icon offline"
                                                : "student-card-icon"
                                    }
                                >
                                    {nodeStatus ===
                                        "online" ? (
                                        <CheckCircle2
                                            size={19}
                                        />
                                    ) : nodeStatus ===
                                        "offline" ? (
                                        <WifiOff
                                            size={19}
                                        />
                                    ) : (
                                        <Activity
                                            size={19}
                                        />
                                    )}
                                </div>

                                <div>
                                    <h3>
                                        Connection Status
                                    </h3>

                                    <p>
                                        Based on the latest
                                        telemetry.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="student-card-refresh"
                                onClick={
                                    handleRefresh
                                }
                                disabled={
                                    refreshing
                                }
                                title="Refresh telemetry"
                                aria-label="Refresh telemetry"
                            >
                                <RefreshCw
                                    size={17}
                                    className={
                                        refreshing
                                            ? "student-spin"
                                            : ""
                                    }
                                />

                                <span>
                                    {refreshing
                                        ? "Refreshing"
                                        : "Refresh"}
                                </span>
                            </button>
                        </div>

                        <div
                            className={
                                nodeStatus ===
                                    "online"
                                    ? "student-status-panel online"
                                    : nodeStatus ===
                                        "offline"
                                        ? "student-status-panel offline"
                                        : "student-status-panel unknown"
                            }
                        >
                            <div className="student-status-panel-icon">
                                {nodeStatus ===
                                    "online" ? (
                                    <CheckCircle2
                                        size={27}
                                    />
                                ) : nodeStatus ===
                                    "offline" ? (
                                    <WifiOff
                                        size={27}
                                    />
                                ) : (
                                    <Activity
                                        size={27}
                                    />
                                )}
                            </div>

                            <div>
                                <strong>
                                    {statusText}
                                </strong>

                                <span>
                                    {
                                        statusDescription
                                    }
                                </span>
                            </div>
                        </div>
                    </section>
                </div>

                {/* ==================================================
                    HISTORY
                ================================================== */}

                {showHistory && (
                    <section className="student-history-section">
                        <div className="student-history-header">
                            <div>
                                <div className="student-history-title">
                                    <History
                                        size={20}
                                    />

                                    <h3>
                                        Historical Telemetry
                                    </h3>
                                </div>

                                <p>
                                    Previous readings from{" "}
                                    <strong>
                                        {satellite?.id}
                                    </strong>
                                </p>
                            </div>

                            {history.records.length >
                                0 && (
                                    <button
                                        type="button"
                                        className="student-download-button"
                                        onClick={() =>
                                            downloadCSV(
                                                history.records,
                                                `${satellite?.id}-telemetry-history.csv`
                                            )
                                        }
                                    >
                                        <Download
                                            size={16}
                                        />

                                        Download History
                                    </button>
                                )}
                        </div>

                        {history.loading && (
                            <div className="student-history-loading">
                                <RefreshCw
                                    size={20}
                                    className="student-spin"
                                />

                                <span>
                                    Loading historical
                                    telemetry...
                                </span>
                            </div>
                        )}

                        {history.error && (
                            <div className="student-history-error">
                                <strong>
                                    Unable to load history
                                </strong>

                                <p>
                                    {
                                        history.error
                                    }
                                </p>

                                <button
                                    type="button"
                                    onClick={
                                        loadHistory
                                    }
                                >
                                    Try again
                                </button>
                            </div>
                        )}

                        {!history.loading &&
                            !history.error &&
                            history.loaded &&
                            history.records.length ===
                            0 && (
                                <div className="student-history-empty">
                                    <History
                                        size={28}
                                    />

                                    <strong>
                                        No historical data
                                    </strong>

                                    <p>
                                        No previous telemetry
                                        records are available
                                        for this satellite.
                                    </p>
                                </div>
                            )}

                        {!history.loading &&
                            !history.error &&
                            history.records.length >
                            0 && (
                                <div className="student-history-table-wrapper">
                                    <table className="student-history-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    Time
                                                </th>

                                                <th>
                                                    Temperature
                                                </th>

                                                <th>
                                                    Humidity
                                                </th>

                                                <th>
                                                    Altitude MSL
                                                </th>

                                                <th>
                                                    Altitude AGL
                                                </th>

                                                <th>
                                                    Pitch
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {history.records.map(
                                                (
                                                    record,
                                                    index
                                                ) => (
                                                    <tr
                                                        key={`${record.eventTime}-${index}`}
                                                    >
                                                        <td>
                                                            {formatDate(
                                                                record.eventTime
                                                            )}
                                                        </td>

                                                        <td>
                                                            {formatNumber(
                                                                record.temperature,
                                                                " °C"
                                                            )}
                                                        </td>

                                                        <td>
                                                            {formatNumber(
                                                                record.humidity,
                                                                " %"
                                                            )}
                                                        </td>

                                                        <td>
                                                            {formatNumber(
                                                                record.altitudeMsl,
                                                                " m"
                                                            )}
                                                        </td>

                                                        <td>
                                                            {formatNumber(
                                                                record.altitudeAgl,
                                                                " m"
                                                            )}
                                                        </td>

                                                        <td>
                                                            {formatNumber(
                                                                record.pitch,
                                                                "°"
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                    </section>
                )}

                {/* ==================================================
                    PRIVACY / INFORMATION
                ================================================== */}

                <div className="student-note">
                    <div className="student-note-icon">
                        <Satellite
                            size={18}
                        />
                    </div>

                    <div>
                        <strong>
                            Your satellite, your data
                        </strong>

                        <p>
                            This dashboard only displays the
                            satellite assigned to your student
                            account.
                        </p>
                    </div>
                </div>

                {/* ==================================================
                    FOOTER
                ================================================== */}

                <footer className="student-footer">
                    <span>
                        {lastUpdated
                            ? `Dashboard updated ${lastUpdated.toLocaleTimeString()}`
                            : "Waiting for update"}
                    </span>

                    <span>
                        Automatic refresh every 30 seconds
                    </span>
                </footer>
            </section>
        </>
    );
}

/* ============================================================
   SMALL COMPONENTS
============================================================ */

type TelemetryCardProps = {
    icon: ReactNode;
    label: string;
    value: string;
    description: string;
    type:
    | "temperature"
    | "humidity"
    | "altitude"
    | "pitch";
};

function TelemetryCard({
    icon,
    label,
    value,
    description,
    type,
}: TelemetryCardProps) {
    return (
        <div className="student-telemetry-card">
            <div
                className={`student-telemetry-icon ${type}`}
            >
                {icon}
            </div>

            <div className="student-telemetry-content">
                <span>
                    {label}
                </span>

                <strong>
                    {value}
                </strong>

                <small>
                    {description}
                </small>
            </div>
        </div>
    );
}

type InfoRowProps = {
    label: string;
    value: string;
};

function InfoRow({
    label,
    value,
}: InfoRowProps) {
    return (
        <div className="student-info-row">
            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>
        </div>
    );
}

/* ============================================================
   CSS
============================================================ */

const dashboardStyles = `
.student-dashboard {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 28px;
    color: #172033;
    font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.student-dashboard *,
.student-dashboard *::before,
.student-dashboard *::after {
    box-sizing: border-box;
}

/* ============================================================
   HEADER
============================================================ */

.student-header {
    margin-bottom: 24px;
}

.student-eyebrow {
    margin-bottom: 6px;
    color: #55719b;
    font-size: 0.69rem;
    font-weight: 800;
    letter-spacing: 0.12em;
}

.student-header h2 {
    margin: 0;
    color: #172033;
    font-size: clamp(1.65rem, 3vw, 2.25rem);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.03em;
}

.student-header p {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 0.91rem;
}

/* ============================================================
   ERROR
============================================================ */

.student-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    padding: 14px 16px;
    border: 1px solid #f1caca;
    border-radius: 13px;
    background: #fff6f6;
    color: #9c3030;
}

.student-error strong {
    display: block;
    font-size: 0.87rem;
}

.student-error p {
    margin: 4px 0 0;
    font-size: 0.78rem;
}

.student-error button {
    flex-shrink: 0;
    padding: 8px 13px;
    border: 1px solid #e0b5b5;
    border-radius: 8px;
    background: #fff;
    color: #9c3030;
    font-weight: 700;
    cursor: pointer;
}

/* ============================================================
   ASSIGNED SATELLITE
============================================================ */

.student-assigned-card {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 28px;
    padding: 18px;
    border: 1px solid #dbe4f0;
    border-radius: 16px;
    background: linear-gradient(
        135deg,
        #ffffff 0%,
        #f8fbff 100%
    );
    box-shadow:
        0 8px 25px rgba(35, 69, 110, 0.05);
}

.student-satellite-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    flex-shrink: 0;
    border-radius: 14px;
    background: #eaf2ff;
    color: #356da8;
}

.student-assigned-content {
    min-width: 0;
}

.student-assigned-content > span {
    display: block;
    margin-bottom: 4px;
    color: #68809e;
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.08em;
}

.student-assigned-content strong {
    display: block;
    color: #18253a;
    font-size: 1.06rem;
    font-weight: 800;
}

.student-assigned-content p {
    margin: 4px 0 0;
    color: #718096;
    font-size: 0.76rem;
}

/* ============================================================
   SECTION
============================================================ */

.student-section {
    margin-bottom: 27px;
}

.student-section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 13px;
}

.student-section-heading h3 {
    margin: 0;
    color: #1c2940;
    font-size: 1.03rem;
    font-weight: 800;
}

.student-section-heading p {
    margin: 5px 0 0;
    color: #718096;
    font-size: 0.79rem;
}

/* ============================================================
   BUTTONS
============================================================ */

.student-download-button,
.student-history-button,
.student-card-refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 39px;
    padding: 0 13px;
    border: 1px solid #d6dfeb;
    border-radius: 10px;
    background: #fff;
    color: #334155;
    font-size: 0.77rem;
    font-weight: 750;
    cursor: pointer;
    transition:
        background 0.18s ease,
        border-color 0.18s ease,
        transform 0.18s ease;
}

.student-download-button:hover,
.student-history-button:hover,
.student-card-refresh:hover {
    background: #f5f9ff;
    border-color: #b9cbe0;
}

.student-history-button.active {
    background: #edf5ff;
    border-color: #b9d0eb;
    color: #28639b;
}

.student-card-refresh:disabled {
    cursor: not-allowed;
    opacity: 0.55;
}

.student-download-button:active,
.student-history-button:active,
.student-card-refresh:active {
    transform: translateY(1px);
}

/* ============================================================
   TELEMETRY CARDS
============================================================ */

.student-telemetry-grid {
    display: grid;
    grid-template-columns:
        repeat(5, minmax(0, 1fr));
    gap: 12px;
}

.student-telemetry-card {
    min-width: 0;
    min-height: 151px;
    padding: 17px;
    border: 1px solid #dfe6ef;
    border-radius: 15px;
    background: #fff;
    box-shadow:
        0 5px 18px rgba(32, 55, 85, 0.045);
    transition:
        transform 0.18s ease,
        box-shadow 0.18s ease;
}

.student-telemetry-card:hover {
    transform: translateY(-2px);
    box-shadow:
        0 9px 25px rgba(32, 55, 85, 0.08);
}

.student-telemetry-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    margin-bottom: 16px;
    border-radius: 11px;
}

.student-telemetry-icon.temperature {
    background: #fff0eb;
    color: #d55b38;
}

.student-telemetry-icon.humidity {
    background: #eaf6ff;
    color: #3686c4;
}

.student-telemetry-icon.altitude {
    background: #edf4ff;
    color: #4c70b0;
}

.student-telemetry-icon.pitch {
    background: #f2edff;
    color: #7655b7;
}

.student-telemetry-content {
    min-width: 0;
}

.student-telemetry-content span {
    display: block;
    margin-bottom: 5px;
    color: #64748b;
    font-size: 0.74rem;
    font-weight: 650;
}

.student-telemetry-content strong {
    display: block;
    overflow: hidden;
    color: #172033;
    font-size: 1.2rem;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.student-telemetry-content small {
    display: block;
    margin-top: 5px;
    overflow: hidden;
    color: #94a3b8;
    font-size: 0.67rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* ============================================================
   MAIN INFORMATION GRID
============================================================ */

.student-main-grid {
    display: grid;
    grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1fr);
    gap: 15px;
}

.student-card {
    overflow: hidden;
    border: 1px solid #dfe6ef;
    border-radius: 15px;
    background: #fff;
    box-shadow:
        0 5px 18px rgba(32, 55, 85, 0.035);
}

.student-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 16px 18px;
    border-bottom: 1px solid #e8edf3;
}

.student-card-title {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
}

.student-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 10px;
    background: #edf4ff;
    color: #4a72a9;
}

.student-card-icon.online {
    background: #eaf8f0;
    color: #27804d;
}

.student-card-icon.offline {
    background: #fff0f0;
    color: #bd4545;
}

.student-card-title h3 {
    margin: 0;
    color: #1c2940;
    font-size: 0.94rem;
    font-weight: 800;
}

.student-card-title p {
    margin: 4px 0 0;
    color: #8190a3;
    font-size: 0.73rem;
}

/* ============================================================
   INFO ROWS
============================================================ */

.student-info-list {
    padding: 3px 18px 7px;
}

.student-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    min-height: 53px;
    border-bottom: 1px solid #edf1f5;
}

.student-info-row:last-child {
    border-bottom: none;
}

.student-info-row span {
    color: #718096;
    font-size: 0.76rem;
}

.student-info-row strong {
    max-width: 68%;
    color: #27364c;
    font-size: 0.78rem;
    font-weight: 700;
    text-align: right;
}

/* ============================================================
   CONNECTION STATUS
============================================================ */

.student-status-panel {
    display: flex;
    align-items: center;
    gap: 13px;
    margin: 15px 18px 18px;
    padding: 19px;
    border-radius: 13px;
}

.student-status-panel.online {
    background: #edf9f2;
    color: #24794a;
}

.student-status-panel.offline {
    background: #fff1f1;
    color: #b13e3e;
}

.student-status-panel.unknown {
    background: #f4f6f8;
    color: #6b7280;
}

.student-status-panel-icon {
    display: flex;
    align-items: center;
    justify-content: center;
}

.student-status-panel strong {
    display: block;
    font-size: 0.94rem;
    font-weight: 800;
}

.student-status-panel span {
    display: block;
    margin-top: 4px;
    font-size: 0.74rem;
    line-height: 1.45;
    opacity: 0.8;
}

/* ============================================================
   HISTORY
============================================================ */

.student-history-section {
    margin-top: 16px;
    overflow: hidden;
    border: 1px solid #dfe6ef;
    border-radius: 15px;
    background: #fff;
    box-shadow:
        0 5px 18px rgba(32, 55, 85, 0.035);
}

.student-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 17px 18px;
    border-bottom: 1px solid #e8edf3;
}

.student-history-title {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #346da6;
}

.student-history-title h3 {
    margin: 0;
    color: #1c2940;
    font-size: 0.96rem;
    font-weight: 800;
}

.student-history-header p {
    margin: 5px 0 0;
    color: #7a899c;
    font-size: 0.75rem;
}

.student-history-table-wrapper {
    width: 100%;
    overflow-x: auto;
}

.student-history-table {
    width: 100%;
    min-width: 760px;
    border-collapse: collapse;
}

.student-history-table th {
    padding: 12px 15px;
    border-bottom: 1px solid #e3e9f0;
    background: #f7faff;
    color: #60738c;
    font-size: 0.69rem;
    font-weight: 800;
    text-align: left;
    white-space: nowrap;
}

.student-history-table td {
    padding: 12px 15px;
    border-bottom: 1px solid #edf1f5;
    color: #334155;
    font-size: 0.75rem;
    white-space: nowrap;
}

.student-history-table tbody tr:hover {
    background: #f8fbff;
}

.student-history-table tbody tr:last-child td {
    border-bottom: none;
}

.student-history-loading,
.student-history-empty {
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    padding: 30px;
    color: #708096;
    text-align: center;
}

.student-history-empty strong {
    color: #334155;
    font-size: 0.88rem;
}

.student-history-empty p {
    max-width: 350px;
    margin: 0;
    font-size: 0.76rem;
    line-height: 1.5;
}

.student-history-error {
    margin: 18px;
    padding: 16px;
    border: 1px solid #efcccc;
    border-radius: 11px;
    background: #fff6f6;
    color: #a13d3d;
}

.student-history-error strong {
    display: block;
    font-size: 0.84rem;
}

.student-history-error p {
    margin: 5px 0 11px;
    font-size: 0.75rem;
}

.student-history-error button {
    padding: 7px 11px;
    border: 1px solid #ddb5b5;
    border-radius: 7px;
    background: #fff;
    color: #a13d3d;
    font-size: 0.74rem;
    font-weight: 700;
    cursor: pointer;
}

/* ============================================================
   NOTE
============================================================ */

.student-note {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-top: 20px;
    padding: 15px 17px;
    border: 1px solid #dce5ef;
    border-radius: 13px;
    background: #f7faff;
}

.student-note-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border-radius: 9px;
    background: #e8f1fc;
    color: #4a73a8;
}

.student-note strong {
    display: block;
    margin: 1px 0 4px;
    color: #2b3d56;
    font-size: 0.81rem;
}

.student-note p {
    margin: 0;
    color: #718096;
    font-size: 0.75rem;
    line-height: 1.5;
}

/* ============================================================
   FOOTER
============================================================ */

.student-footer {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    margin-top: 15px;
    color: #8a98a9;
    font-size: 0.69rem;
}

/* ============================================================
   LOADING
============================================================ */

.student-loading {
    min-height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #516276;
}

.student-loading strong {
    display: block;
    font-size: 0.9rem;
}

.student-loading p {
    margin: 4px 0 0;
    color: #8794a5;
    font-size: 0.77rem;
}

.student-spin {
    animation:
        student-spin
        0.9s
        linear
        infinite;
}

@keyframes student-spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

/* ============================================================
   TABLET
============================================================ */

@media (max-width: 1150px) {
    .student-telemetry-grid {
        grid-template-columns:
            repeat(3, minmax(0, 1fr));
    }
}

/* ============================================================
   SMALL TABLET
============================================================ */

@media (max-width: 850px) {
    .student-dashboard {
        padding: 21px;
    }

    .student-telemetry-grid {
        grid-template-columns:
            repeat(2, minmax(0, 1fr));
    }

    .student-main-grid {
        grid-template-columns: 1fr;
    }
}

/* ============================================================
   MOBILE
============================================================ */

@media (max-width: 600px) {
    .student-dashboard {
        padding: 15px;
    }

    .student-assigned-card {
        padding: 15px;
    }

    .student-section-heading,
    .student-history-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .student-download-button {
        width: 100%;
    }

    .student-telemetry-grid {
        grid-template-columns: 1fr;
    }

    .student-telemetry-card {
        min-height: 115px;
    }

    .student-card-header {
        align-items: flex-start;
    }

    .student-card-refresh {
        flex-shrink: 0;
    }

    .student-history-header {
        gap: 12px;
    }

    .student-history-header
        .student-download-button {
        width: 100%;
    }

    .student-error {
        align-items: flex-start;
        flex-direction: column;
    }

    .student-error button {
        width: 100%;
    }

    .student-footer {
        flex-direction: column;
        gap: 5px;
    }
}

/* ============================================================
   VERY SMALL PHONE
============================================================ */

@media (max-width: 400px) {
    .student-dashboard {
        padding: 12px;
    }

    .student-card-header {
        gap: 10px;
    }

    .student-card-refresh span {
        display: none;
    }

    .student-card-refresh {
        width: 38px;
        padding: 0;
    }

    .student-assigned-card {
        gap: 11px;
    }

    .student-satellite-icon {
        width: 45px;
        height: 45px;
    }
}
`;