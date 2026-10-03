import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    Download,
    MapPin,
    RefreshCw,
    Satellite,
    Search,
    Signal,
    Thermometer,
    Droplets,
    Gauge,
    Clock3,
    ChevronDown,
    Wifi,
    WifiOff,
} from "lucide-react";

import {
    MapContainer,
    Marker,
    Popup,
    TileLayer,
    useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import "./SatelliteDashboard.css";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_BASE_URL = (
    import.meta.env.VITE_API_URL || ""
).replace(/\/$/, "");

const AUTO_REFRESH_MS = 30_000;
const OFFLINE_AFTER_MS = 5 * 60 * 1000;


/* =========================================================
   TYPES
   ========================================================= */

export type SatelliteTelemetry = {
    id: string;
    name: string;

    latitude: number | null;
    longitude: number | null;

    temperature: number | null;
    humidity: number | null;
    pressure: number | null;

    timestamp: string | null;

    signal: number | null;

    status: "online" | "offline" | "warning" | "unknown";

    altitude?: number | null;
    speed?: number | null;
    battery?: number | null;
};

type BackendTelemetry = {
    satellite_id: string;
    event_time?: string | null;
    altitude_msl?: number | null;
    altitude_agl?: number | null;
    temperature?: number | null;
    humidity?: number | null;
    pitch?: number | null;
    roll?: number | null;
    acceleration?: number | null;
    wifi_rssi?: number | null;
};

type SchoolSatelliteResponse = {
    success: boolean;
    count: number;
    satellites: {
        satellite_id: string;
        telemetry: BackendTelemetry | null;
    }[];
    message?: string;
};


/* =========================================================
   LEAFLET ICON
   ========================================================= */

const satelliteIcon = new L.DivIcon({
    className: "satellite-map-icon",
    html: `
        <div class="satellite-marker">
            <div class="satellite-marker-core">
                <span>✦</span>
            </div>
            <div class="satellite-marker-pulse"></div>
        </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -20],
});


/* =========================================================
   MAP CENTER COMPONENT
   ========================================================= */

function MapCenter({
    latitude,
    longitude,
}: {
    latitude: number;
    longitude: number;
}) {
    const map = useMap();

    useEffect(() => {
        map.flyTo(
            [latitude, longitude],
            Math.max(map.getZoom(), 5),
            {
                duration: 0.8,
            }
        );
    }, [latitude, longitude, map]);

    return null;
}


/* =========================================================
   DATA NORMALIZATION
   ========================================================= */

function numberOrNull(value: unknown): number | null {
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


/* =========================================================
   DATA PROVIDER
   ========================================================= */

function parseServerDate(value: string | null): Date | null {
    if (!value) {
        return null;
    }

    const normalized = value.includes("T")
        ? value
        : value.replace(" ", "T");
    const date = new Date(normalized);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

function getNodeStatus(timestamp: string | null): SatelliteTelemetry["status"] {
    const date = parseServerDate(timestamp);

    if (!date) {
        return "unknown";
    }

    const age = Date.now() - date.getTime();

    return age < 0 || age <= OFFLINE_AFTER_MS
        ? "online"
        : "offline";
}

function normalizeSatellite(
    record: SchoolSatelliteResponse["satellites"][number]
): SatelliteTelemetry {
    const telemetry = record.telemetry;
    const timestamp = telemetry?.event_time ?? null;

    return {
        id: record.satellite_id,
        name: "",
        latitude: null,
        longitude: null,
        temperature: numberOrNull(telemetry?.temperature),
        humidity: numberOrNull(telemetry?.humidity),
        pressure: null,
        timestamp,
        signal: numberOrNull(telemetry?.wifi_rssi),
        status: getNodeStatus(timestamp),
        altitude: numberOrNull(telemetry?.altitude_msl),
        speed: null,
        battery: null,
    };
}

async function fetchSatelliteData(): Promise<
    SatelliteTelemetry[]
> {
    const response = await fetch(
        `${API_BASE_URL}/api/v1/telemetry/school`,
        {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json",
            },
            cache: "no-store",
        }
    );

    let json: SchoolSatelliteResponse;

    try {
        json = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || !json.success) {
        throw new Error(
            json.message || "Unable to load satellite data."
        );
    }

    if (!Array.isArray(json.satellites)) {
        throw new Error("Satellite response format is invalid.");
    }

    return json.satellites
        .filter((record) =>
            record &&
            typeof record.satellite_id === "string" &&
            record.satellite_id.length > 0
        )
        .map(normalizeSatellite);
}


/* =========================================================
   HELPERS
   ========================================================= */

function formatDate(
    value: string | null
): string {
    const date = parseServerDate(value);

    if (!date) {
        return value || "—";
    }

    return date.toLocaleString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }
    );
}


function downloadCSV(
    satellites: SatelliteTelemetry[]
) {
    const headers = [
        "Satellite ID",
        "Satellite Name",
        "Latitude",
        "Longitude",
        "Temperature",
        "Humidity",
        "Pressure",
        "Date & Time",
        "Signal",
        "Status",
        "Altitude",
        "Speed",
        "Battery",
    ];

    const rows = satellites.map(
        (satellite) => [
            satellite.id,
            satellite.name || "—",
            satellite.latitude ?? "",
            satellite.longitude ?? "",
            satellite.temperature ?? "",
            satellite.humidity ?? "",
            satellite.pressure ?? "",
            satellite.timestamp ?? "",
            satellite.signal ?? "",
            satellite.status,
            satellite.altitude ?? "",
            satellite.speed ?? "",
            satellite.battery ?? "",
        ]
    );

    const csv = [
        headers,
        ...rows,
    ]
        .map((row) =>
            row
                .map((value) =>
                    `"${String(value).replace(
                        /"/g,
                        '""'
                    )}"`
                )
                .join(",")
        )
        .join("\n");

    const blob = new Blob(
        [csv],
        {
            type: "text/csv;charset=utf-8;",
        }
    );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download =
        `satellite-data-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}


/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function SatelliteDashboard() {
    const [satellites, setSatellites] =
        useState<SatelliteTelemetry[]>(
            []
        );

    const [selectedSatelliteId, setSelectedSatelliteId] =
        useState<string>(
            ""
        );

    const [search, setSearch] =
        useState("");

    const [isLoading, setIsLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [lastUpdated, setLastUpdated] =
        useState<Date | null>(null);


    /* =====================================================
       LOAD DATA
       ===================================================== */

    const loadData = async () => {
        try {
            setIsLoading(true);
            setError("");

            const data =
                await fetchSatelliteData();

            setSatellites((currentSatellites) =>
                data.map((satellite) => {
                    if (satellite.timestamp) {
                        return satellite;
                    }

                    const previousSatellite =
                        currentSatellites.find(
                            (current) => current.id === satellite.id
                        );

                    return previousSatellite
                        ? {
                            ...previousSatellite,
                            status: getNodeStatus(
                                previousSatellite.timestamp
                            ),
                        }
                        : satellite;
                })
            );

            setSelectedSatelliteId((currentId) =>
                data.some(
                    (satellite) =>
                        satellite.id === currentId
                )
                    ? currentId
                    : data[0]?.id ?? ""
            );

            setLastUpdated(new Date());
        } catch (err) {
            console.error(
                "Satellite data error:",
                err
            );

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load satellite data."
            );
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        void loadData();

        const interval =
            window.setInterval(
                () => void loadData(),
                AUTO_REFRESH_MS
            );

        return () =>
            window.clearInterval(
                interval
            );
    }, []);


    /* =====================================================
       FILTER
       ===================================================== */

    const filteredSatellites =
        useMemo(() => {
            const query =
                search
                    .trim()
                    .toLowerCase();

            if (!query) {
                return satellites;
            }

            return satellites.filter(
                (satellite) =>
                    satellite.name
                        .toLowerCase()
                        .includes(query) ||
                    satellite.id
                        .toLowerCase()
                        .includes(query)
            );
        }, [
            satellites,
            search,
        ]);


    const selectedSatellite =
        satellites.find(
            (satellite) =>
                satellite.id ===
                selectedSatelliteId
        ) ??
        satellites[0] ??
        null;


    /* =====================================================
       STATISTICS
       ===================================================== */

    const onlineCount =
        satellites.filter(
            (satellite) =>
                satellite.status ===
                "online"
        ).length;

    const warningCount: number | null = null;

    const offlineCount =
        satellites.filter(
            (satellite) =>
                satellite.status ===
                "offline"
        ).length;


    /* =====================================================
       RENDER
       ===================================================== */

    return (
        <div className="satellite-dashboard">

            {/* =================================================
                TOP HEADER
            ================================================= */}

            <header className="satellite-header">

                <div className="satellite-header-left">

                    <div className="satellite-brand-icon">
                        <Satellite
                            size={24}
                        />
                    </div>

                    <div>
                        <h1>
                            Satellite Operations
                        </h1>

                        <p>
                            Monitor your school's
                            satellite telemetry
                        </p>
                    </div>

                </div>


                <div className="satellite-header-actions">

                    <div className="live-indicator">
                        <span className="live-dot" />
                        LIVE
                    </div>

                    <button
                        className="refresh-button"
                        onClick={
                            loadData
                        }
                        disabled={
                            isLoading
                        }
                    >
                        <RefreshCw
                            size={16}
                            className={
                                isLoading
                                    ? "spin"
                                    : ""
                            }
                        />

                        Refresh
                    </button>

                </div>

            </header>


            {/* =================================================
                ERROR
            ================================================= */}

            {error && (
                <div className="satellite-error">
                    <WifiOff size={18} />

                    <span>
                        {error}
                    </span>

                    <button
                        onClick={
                            loadData
                        }
                    >
                        Retry
                    </button>
                </div>
            )}


            {/* =================================================
                OVERVIEW CARDS
            ================================================= */}

            <section className="satellite-stat-grid">

                <div className="satellite-stat-card">

                    <div className="stat-icon">
                        <Satellite
                            size={20}
                        />
                    </div>

                    <div>
                        <span>
                            Total Satellites
                        </span>

                        <strong>
                            {
                                satellites.length
                            }
                        </strong>
                    </div>

                </div>


                <div className="satellite-stat-card">

                    <div className="stat-icon online">
                        <Activity
                            size={20}
                        />
                    </div>

                    <div>
                        <span>
                            Online
                        </span>

                        <strong>
                            {onlineCount}
                        </strong>
                    </div>

                </div>


                <div className="satellite-stat-card">

                    <div className="stat-icon warning">
                        <Signal
                            size={20}
                        />
                    </div>

                    <div>
                        <span>
                            Warning
                        </span>

                        <strong>
                            {warningCount ?? "—"}
                        </strong>
                    </div>

                </div>


                <div className="satellite-stat-card">

                    <div className="stat-icon offline">
                        <WifiOff
                            size={20}
                        />
                    </div>

                    <div>
                        <span>
                            Offline
                        </span>

                        <strong>
                            {offlineCount}
                        </strong>
                    </div>

                </div>

            </section>


            {/* =================================================
                MAIN GRID
            ================================================= */}

            <section className="satellite-main-grid">

                {/* =================================================
                    MAP
                ================================================= */}

                <div className="satellite-panel map-panel">

                    <div className="panel-header">

                        <div>
                            <h2>
                                Satellite Locations
                            </h2>

                            <p>
                                Current reported
                                positions
                            </p>
                        </div>

                        <div className="map-status">
                            <MapPin
                                size={15}
                            />

                            {
                                satellites.length
                            }{" "}
                            tracked
                        </div>

                    </div>


                    <div className="satellite-map">

                        {selectedSatellite && (
                            <MapContainer
                                center={[19.7515, 75.7139]}
                                zoom={7}
                                scrollWheelZoom
                                className="leaflet-map"
                            >


                                <TileLayer
                                    attribution='&copy; OpenStreetMap contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                {selectedSatellite.latitude !== null &&
                                    selectedSatellite.longitude !== null && (
                                        <MapCenter
                                            latitude={selectedSatellite.latitude}
                                            longitude={selectedSatellite.longitude}
                                        />
                                    )}


                                {filteredSatellites
                                    .filter(
                                        (satellite): satellite is SatelliteTelemetry & {
                                            latitude: number;
                                            longitude: number;
                                        } =>
                                            satellite.latitude !== null &&
                                            satellite.longitude !== null
                                    )
                                    .map(
                                        (
                                            satellite
                                        ) => (
                                            <Marker
                                                key={
                                                    satellite.id
                                                }
                                                position={[
                                                    satellite.latitude,
                                                    satellite.longitude,
                                                ]}
                                                icon={
                                                    satelliteIcon
                                                }
                                                eventHandlers={{
                                                    click:
                                                        () =>
                                                            setSelectedSatelliteId(
                                                                satellite.id
                                                            ),
                                                }}
                                            >

                                                <Popup>

                                                    <div className="map-popup">

                                                        <strong>
                                                            {
                                                                satellite.name || "—"
                                                            }
                                                        </strong>

                                                        <span>
                                                            {
                                                                satellite.id
                                                            }
                                                        </span>

                                                        <small>
                                                            Lat:{" "}
                                                            {
                                                                satellite.latitude
                                                            }

                                                            <br />

                                                            Lon:{" "}
                                                            {
                                                                satellite.longitude
                                                            }
                                                        </small>

                                                    </div>

                                                </Popup>

                                            </Marker>
                                        )
                                    )}

                            </MapContainer>
                        )}

                    </div>

                </div>


                {/* =================================================
                    SATELLITE LIST
                ================================================= */}

                <div className="satellite-panel satellite-list-panel">

                    <div className="panel-header">

                        <div>
                            <h2>
                                My Satellites
                            </h2>

                            <p>
                                Select a satellite
                            </p>
                        </div>

                    </div>


                    <div className="satellite-search">

                        <Search
                            size={17}
                        />

                        <input
                            type="text"
                            placeholder="Search satellite..."
                            value={search}
                            onChange={(event) =>
                                setSearch(
                                    event.target.value
                                )
                            }
                        />

                    </div>


                    <div className="satellite-list">

                        {filteredSatellites.map(
                            (satellite) => {

                                const isSelected =
                                    satellite.id ===
                                    selectedSatelliteId;

                                return (
                                    <button
                                        key={
                                            satellite.id
                                        }
                                        className={`satellite-list-item ${isSelected
                                            ? "selected"
                                            : ""
                                            }`}
                                        onClick={() =>
                                            setSelectedSatelliteId(
                                                satellite.id
                                            )
                                        }
                                    >

                                        <div className="satellite-list-icon">
                                            <Satellite
                                                size={18}
                                            />
                                        </div>

                                        <div className="satellite-list-content">

                                            <strong>
                                                {
                                                    satellite.name || "—"
                                                }
                                            </strong>

                                            <span>
                                                {
                                                    satellite.id
                                                }
                                            </span>

                                        </div>

                                        <span
                                            className={`status-pill ${satellite.status}`}
                                        >
                                            <span />
                                            {
                                                satellite.status
                                            }
                                        </span>

                                    </button>
                                );
                            }
                        )}

                    </div>

                </div>

            </section>


            {/* =================================================
                SELECTED SATELLITE
            ================================================= */}

            {selectedSatellite && (
                <section className="selected-satellite-section">

                    <div className="selected-satellite-header">

                        <div>

                            <div className="selected-title-row">

                                <div className="selected-satellite-icon">
                                    <Satellite
                                        size={22}
                                    />
                                </div>

                                <div>

                                    <h2>
                                        {
                                                selectedSatellite.name || "—"
                                        }
                                    </h2>

                                    <p>
                                        {
                                            selectedSatellite.id
                                        }
                                    </p>

                                </div>

                                <span
                                    className={`status-pill large ${selectedSatellite.status}`}
                                >
                                    <span />
                                    {
                                        selectedSatellite.status
                                    }
                                </span>

                            </div>

                        </div>


                        <div className="selected-actions">

                            <button
                                className="secondary-action"
                                onClick={() =>
                                    downloadCSV(
                                        [selectedSatellite]
                                    )
                                }
                            >
                                <Download
                                    size={16}
                                />

                                Download Data
                            </button>

                        </div>

                    </div>


                    {/* =================================================
                        TELEMETRY CARDS
                    ================================================= */}

                    <div className="telemetry-grid">

                        <TelemetryCard
                            icon={
                                <Thermometer
                                    size={20}
                                />
                            }
                            label="Temperature"
                            value={
                                selectedSatellite.temperature
                            }
                            unit="°C"
                        />

                        <TelemetryCard
                            icon={
                                <Droplets
                                    size={20}
                                />
                            }
                            label="Humidity"
                            value={
                                selectedSatellite.humidity
                            }
                            unit="%"
                        />

                        <TelemetryCard
                            icon={
                                <Gauge
                                    size={20}
                                />
                            }
                            label="Pressure"
                            value={
                                selectedSatellite.pressure
                            }
                            unit="hPa"
                        />

                        <TelemetryCard
                            icon={
                                <Signal
                                    size={20}
                                />
                            }
                            label="Wi-Fi RSSI"
                            value={
                                selectedSatellite.signal
                            }
                            unit=" dBm"
                        />

                        <TelemetryCard
                            icon={
                                <Activity
                                    size={20}
                                />
                            }
                            label="Altitude MSL"
                            value={
                                selectedSatellite.altitude
                            }
                            unit=" m"
                        />

                        <TelemetryCard
                            icon={
                                <Wifi
                                    size={20}
                                />
                            }
                            label="Battery"
                            value={
                                selectedSatellite.battery
                            }
                            unit="%"
                        />

                    </div>


                    {/* =================================================
                        DATA DETAILS
                    ================================================= */}

                    <div className="data-details-grid">

                        <div className="data-detail-card">

                            <div className="detail-icon">
                                <MapPin
                                    size={18}
                                />
                            </div>

                            <div>

                                <span>
                                    Current Location
                                </span>

                                <strong>
                                    {selectedSatellite.latitude !== null &&
                                    selectedSatellite.longitude !== null
                                        ? `${selectedSatellite.latitude.toFixed(5)}° / ${selectedSatellite.longitude.toFixed(5)}°`
                                        : "—"}
                                </strong>

                            </div>

                        </div>


                        <div className="data-detail-card">

                            <div className="detail-icon">
                                <Clock3
                                    size={18}
                                />
                            </div>

                            <div>

                                <span>
                                    Last Telemetry
                                </span>

                                <strong>
                                    {formatDate(selectedSatellite.timestamp)}
                                </strong>

                            </div>

                        </div>


                        <div className="data-detail-card">

                            <div className="detail-icon">
                                <Activity
                                    size={18}
                                />
                            </div>

                            <div>

                                <span>
                                    Speed
                                </span>

                                <strong>
                                    {
                                        selectedSatellite.speed ??
                                        "—"
                                    }{" "}
                                    {selectedSatellite.speed !==
                                        null &&
                                        selectedSatellite.speed !==
                                        undefined
                                        ? "km/s"
                                        : ""}
                                </strong>

                            </div>

                        </div>

                    </div>


                    {/* =================================================
                        HISTORICAL DATA
                    ================================================= */}

                    <div className="historical-panel">

                        <div className="panel-header">

                            <div>
                                <h2>
                                    Historical Telemetry
                                </h2>

                                <p>
                                    Historical charts will
                                    appear here as telemetry
                                    records accumulate.
                                </p>
                            </div>

                            <button
                                className="period-button"
                            >
                                Last 24 Hours
                                <ChevronDown
                                    size={16}
                                />
                            </button>

                        </div>


                        <div className="chart-placeholder">

                            <Activity
                                size={30}
                            />

                            <h3>
                                Historical data ready
                            </h3>

                            <p>
                                Connect your telemetry
                                history endpoint to display
                                temperature, humidity and
                                pressure trends here.
                            </p>

                        </div>

                    </div>

                </section>
            )}


            {/* =================================================
                FOOTER INFORMATION
            ================================================= */}

            <footer className="satellite-footer">

                <div>

                    <span className="footer-live-dot" />

                    Data connection active

                </div>

                <span>

                    Last updated:{" "}

                    {lastUpdated
                        ? lastUpdated.toLocaleTimeString()
                        : "—"}

                </span>

            </footer>

        </div>
    );
}


/* =========================================================
   TELEMETRY CARD
   ========================================================= */

function TelemetryCard({
    icon,
    label,
    value,
    unit,
}: {
    icon: React.ReactNode;
    label: string;
    value: number | null | undefined;
    unit: string;
}) {
    return (
        <div className="telemetry-card">

            <div className="telemetry-card-top">

                <div className="telemetry-icon">
                    {icon}
                </div>

                <span>
                    {label}
                </span>

            </div>

            <div className="telemetry-value">

                <strong>
                    {value === null ||
                        value === undefined
                        ? "—"
                        : value}
                </strong>

                <span>
                    {value === null ||
                        value === undefined
                        ? ""
                        : unit}
                </span>

            </div>

        </div>
    );
}