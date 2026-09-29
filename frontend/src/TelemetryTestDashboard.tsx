import {
    ChevronLeft,
    ChevronRight,
    Download,
    Droplets,
    Gauge,
    Globe2,
    LayoutDashboard,
    Map as MapIcon,
    Menu,
    Moon,
    Navigation,
    RefreshCw,
    Search,
    Satellite,
    Signal,
    Sun,
    Thermometer,
    X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* =========================================================
   TYPES
========================================================= */

type SatelliteStatus = "online" | "warning" | "offline";

type Satellite = {
    id: string;
    name: string;
    school: string;
    student: string;
    location: string;

    latitude: number;
    longitude: number;

    temperature: number;
    humidity: number;
    pressure: number;
    altitude: number;
    battery: number;
    signal: number;

    status: SatelliteStatus;
    timestamp: string;
};

/* =========================================================
   CONFIGURATION
========================================================= */

/*
 * Existing telemetry API.
 *
 * We are connecting the common dashboard to the
 * telemetry backend that we already built.
 */
const TELEMETRY_API = "/api/v1/telemetry/latest";

/*
 * How frequently the dashboard asks the backend
 * for the latest snapshot.
 *
 * This is NOT the main backend throttling.
 * It only controls browser polling.
 */
const POLL_INTERVAL = 5000;

// Five missed packets at the expected two-second reporting interval.
const DEFAULT_TELEMETRY_STALE_THRESHOLD_MS = 10_000;
const configuredTelemetryStaleThresholdMs = Number(
    import.meta.env.VITE_TELEMETRY_STALE_THRESHOLD_MS,
);
const TELEMETRY_STALE_THRESHOLD_MS =
    Number.isFinite(configuredTelemetryStaleThresholdMs) &&
        configuredTelemetryStaleThresholdMs > 0
        ? configuredTelemetryStaleThresholdMs
        : DEFAULT_TELEMETRY_STALE_THRESHOLD_MS;

/*
 * React update throttle.
 *
 * If data arrives repeatedly, React will not be
 * forced to update continuously.
 */
const FRONTEND_UPDATE_THROTTLE = 250;

/*
 * Maximum number of cards rendered in the directory
 * at one time.
 *
 * We do not put all 1,200 cards into the DOM.
 */
const DIRECTORY_PAGE_SIZE = 60;

/*
 * Number of satellites displayed in the small
 * overview directory.
 */
const OVERVIEW_LIST_SIZE = 15;

/*
 * Expected network size.
 */
const TOTAL_SATELLITES = 1200;

/* =========================================================
   OPTIONAL DEMO MODE
========================================================= */

/*
 * Set this to true only if you want to test the UI
 * without the telemetry backend.
 *
 * For the real system keep this FALSE.
 */
const DEMO_MODE = false;

/* =========================================================
   DEMO DATA
========================================================= */

const demoSchools = [
    "Horizon Academy CBSE",
    "Soumodip GGS",
    "Dr. G.G. Shah English Medium School",
    "Vidula and Vivek Dr. Dada Gujar English School",
    "Versatile School",
    "Pune Public School",
    "Modern High School",
    "New Era Academy",
];

const demoCities = [
    "Pune, Maharashtra",
    "Mumbai, Maharashtra",
    "Nashik, Maharashtra",
    "Nagpur, Maharashtra",
    "Kolhapur, Maharashtra",
    "Satara, Maharashtra",
    "Ahmednagar, Maharashtra",
    "Aurangabad, Maharashtra",
];

function createDemoSatellites(): Satellite[] {
    return Array.from(
        { length: TOTAL_SATELLITES },
        (_, index) => {
            const temperature = Number(
                (24 + Math.random() * 7).toFixed(1),
            );

            const humidity = Number(
                (48 + Math.random() * 25).toFixed(1),
            );

            return {
                id: `SAT-${String(index + 1).padStart(4, "0")}`,

                name: `CanSat-${String(index + 1).padStart(
                    2,
                    "0",
                )}`,

                school:
                    demoSchools[
                    index % demoSchools.length
                    ],

                student: `Student ${index + 1}`,

                location:
                    demoCities[index % demoCities.length],

                latitude: 15 + Math.random() * 8,

                longitude: 72.5 + Math.random() * 6,

                temperature,

                humidity,

                pressure: Number(
                    (930 + Math.random() * 35).toFixed(1),
                ),

                altitude: Math.round(
                    400 + Math.random() * 350,
                ),

                battery: Math.round(
                    65 + Math.random() * 35,
                ),

                signal: Math.round(
                    65 + Math.random() * 35,
                ),

                status:
                    index % 37 === 0
                        ? "offline"
                        : index % 19 === 0
                            ? "warning"
                            : "online",

                timestamp: new Date().toISOString(),
            };
        },
    );
}

/* =========================================================
   DATA NORMALIZATION
========================================================= */

/*
 * The backend response can have slightly different
 * property names depending on the existing API.
 *
 * This function converts the response into the one
 * Satellite structure used by the dashboard.
 */

function toNumber(
    value: unknown,
    fallback = 0,
): number {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
}

function toStringValue(
    value: unknown,
    fallback = "",
): string {
    if (
        value === null ||
        value === undefined
    ) {
        return fallback;
    }

    return String(value);
}

function normalizeTelemetryEventTime(
    value: string,
): string {
    const trimmedValue = value.trim();
    const mysqlUtcTimestamp =
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

    return mysqlUtcTimestamp.test(trimmedValue)
        ? `${trimmedValue.replace(" ", "T")}Z`
        : trimmedValue;
}

function parseTelemetryEventTime(
    value: string,
): number {
    return Date.parse(
        normalizeTelemetryEventTime(value),
    );
}

function getTelemetryStatus(
    eventTime: string,
    now: number,
): SatelliteStatus {
    const eventTimeMs =
        parseTelemetryEventTime(eventTime);
    const ageMs = now - eventTimeMs;

    if (
        !Number.isFinite(eventTimeMs) ||
        ageMs > TELEMETRY_STALE_THRESHOLD_MS
    ) {
        return "offline";
    }

    return "online";
}

function normalizeSatellite(
    raw: Record<string, unknown>,
    index: number,
): Satellite {
    const id = toStringValue(
        raw.satellite_id ??
        raw.satelliteId ??
        raw.id ??
        raw.can_sat_id ??
        raw.canSatId,
        `SAT-${String(index + 1).padStart(4, "0")}`,
    );

    const latitude = toNumber(
        raw.latitude ??
        raw.lat ??
        (raw.gps as Record<string, unknown> | undefined)
            ?.latitude ??
        (raw.gps as Record<string, unknown> | undefined)
            ?.lat,
        0,
    );

    const longitude = toNumber(
        raw.longitude ??
        raw.lng ??
        raw.lon ??
        (raw.gps as Record<string, unknown> | undefined)
            ?.longitude ??
        (raw.gps as Record<string, unknown> | undefined)
            ?.lng,
        0,
    );
    const timestamp = toStringValue(
        raw.event_time,
        "",
    );
    const normalizedTimestamp =
        normalizeTelemetryEventTime(timestamp);

    return {
        id,

        name: toStringValue(
            raw.name ??
            raw.satellite_name ??
            raw.satelliteName ??
            raw.can_sat_name,
            id,
        ),

        school: toStringValue(
            raw.school ??
            raw.school_name ??
            raw.schoolName,
            "School",
        ),

        student: toStringValue(
            raw.student ??
            raw.student_name ??
            raw.studentName,
            "",
        ),

        location: toStringValue(
            raw.location ??
            raw.city ??
            raw.place,
            "",
        ),

        latitude,

        longitude,

        temperature: toNumber(
            raw.temperature ??
            raw.temp ??
            raw.temperature_c,
        ),

        humidity: toNumber(
            raw.humidity ??
            raw.humidity_percent,
        ),

        pressure: toNumber(
            raw.pressure ??
            raw.pressure_hpa,
        ),

        altitude: toNumber(
            raw.altitude ??
            raw.altitude_m,
        ),

        battery: toNumber(
            raw.battery ??
            raw.battery_percentage ??
            raw.battery_percent,
        ),

        signal: toNumber(
            raw.signal ??
            raw.signal_strength,
        ),

        status: getTelemetryStatus(
            normalizedTimestamp,
            Date.now(),
        ),

        timestamp: normalizedTimestamp,
    };
}

function extractTelemetryArray(
    response: unknown,
): Record<string, unknown>[] {
    if (Array.isArray(response)) {
        return response as Record<string, unknown>[];
    }

    if (
        response &&
        typeof response === "object"
    ) {
        const object =
            response as Record<string, unknown>;

        const possibleArrays = [
            object.data,
            object.telemetry,
            object.satellites,
            object.results,
        ];

        for (const value of possibleArrays) {
            if (Array.isArray(value)) {
                return value as Record<
                    string,
                    unknown
                >[];
            }
        }
    }

    return [];
}

/* =========================================================
   CSV EXPORT
========================================================= */

function downloadCSV(
    satellites: Satellite[],
) {
    const header = [
        "Satellite ID",
        "Name",
        "School",
        "Student",
        "Location",
        "Latitude",
        "Longitude",
        "Temperature",
        "Humidity",
        "Pressure",
        "Altitude",
        "Battery",
        "Signal",
        "Status",
        "Timestamp",
    ];

    const rows = satellites.map((satellite) => [
        satellite.id,
        satellite.name,
        satellite.school,
        satellite.student,
        satellite.location,
        satellite.latitude,
        satellite.longitude,
        satellite.temperature,
        satellite.humidity,
        satellite.pressure,
        satellite.altitude,
        satellite.battery,
        satellite.signal,
        satellite.status,
        satellite.timestamp,
    ]);

    const csv = [header, ...rows]
        .map((row) =>
            row
                .map(
                    (value) =>
                        `"${String(value).replace(
                            /"/g,
                            '""',
                        )}"`,
                )
                .join(","),
        )
        .join("\n");

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;
    link.download =
        "satellite-telemetry.csv";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}

/* =========================================================
   MAP
========================================================= */

type SatelliteMapProps = {
    satellites: Satellite[];
    selectedSatellite: Satellite | null;
    onSelect: (satellite: Satellite) => void;
};

function SatelliteMap({
    satellites,
    selectedSatellite,
    onSelect,
}: SatelliteMapProps) {
    const mapElementRef =
        useRef<HTMLDivElement | null>(null);

    const mapRef =
        useRef<L.Map | null>(null);

    const markerLayerRef =
        useRef<L.LayerGroup | null>(null);

    /*
     * VERY IMPORTANT:
     *
     * Markers are stored by satellite ID.
     *
     * We create a marker once and then update
     * that marker instead of recreating all
     * 1,200 markers.
     */
    const markersRef =
        useRef<Map<string, L.Marker>>(
            new Map(),
        );

    const onSelectRef =
        useRef(onSelect);

    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);

    /* =====================================================
       CREATE MAP ONCE
    ===================================================== */

    useEffect(() => {
        if (
            !mapElementRef.current ||
            mapRef.current
        ) {
            return;
        }

        const map = L.map(
            mapElementRef.current,
            {
                center: [18.52, 73.85],

                zoom: 6,

                minZoom: 4,

                maxZoom: 15,

                zoomControl: false,
            },
        );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                attribution:
                    "&copy; OpenStreetMap contributors",

                maxZoom: 19,
            },
        ).addTo(map);

        L.control
            .zoom({
                position: "topright",
            })
            .addTo(map);

        markerLayerRef.current =
            L.layerGroup().addTo(map);

        mapRef.current = map;

        /*
         * Leaflet sometimes calculates the map
         * size before its container is fully visible.
         */
        window.setTimeout(() => {
            map.invalidateSize();
        }, 100);

        return () => {
            markersRef.current.forEach(
                (marker) => marker.remove(),
            );

            markersRef.current.clear();

            markerLayerRef.current?.clearLayers();

            map.remove();

            mapRef.current = null;

            markerLayerRef.current = null;
        };
    }, []);

    /* =====================================================
       UPDATE MARKERS WITHOUT RECREATING THEM
    ===================================================== */

    useEffect(() => {
        const map = mapRef.current;

        const layer =
            markerLayerRef.current;

        if (!map || !layer) {
            return;
        }

        const currentIds =
            new Set<string>();

        for (const satellite of satellites) {
            currentIds.add(satellite.id);

            /*
             * Skip invalid coordinates.
             */
            if (
                !Number.isFinite(
                    satellite.latitude,
                ) ||
                !Number.isFinite(
                    satellite.longitude,
                ) ||
                (
                    satellite.latitude === 0 &&
                    satellite.longitude === 0
                )
            ) {
                continue;
            }

            let marker =
                markersRef.current.get(
                    satellite.id,
                );

            /*
             * Create marker only if this satellite
             * does not already have one.
             */
            if (!marker) {
                const icon =
                    L.divIcon({
                        className:
                            "satellite-marker-wrapper",

                        html: `
                            <div class="satellite-marker online">
                                <div class="satellite-marker-dot"></div>
                            </div>
                        `,

                        iconSize: [18, 18],

                        iconAnchor: [9, 9],
                    });

                marker =
                    L.marker(
                        [
                            satellite.latitude,
                            satellite.longitude,
                        ],
                        {
                            icon,
                        },
                    );

                marker.on(
                    "click",
                    () => {
                        onSelectRef.current(
                            satellite,
                        );
                    },
                );

                marker.addTo(layer);

                markersRef.current.set(
                    satellite.id,
                    marker,
                );
            }

            /*
             * Update existing marker position.
             */
            marker.setLatLng([
                satellite.latitude,
                satellite.longitude,
            ]);

            /*
             * Update marker color/status.
             */
            const markerElement =
                marker.getElement();

            const markerVisual =
                markerElement?.querySelector(
                    ".satellite-marker",
                );

            if (markerVisual) {
                markerVisual.className =
                    `satellite-marker ${satellite.status}`;
            }

            /*
             * Update tooltip.
             */
            marker.bindTooltip(
                `
                    <strong>${escapeHtml(
                    satellite.name,
                )}</strong><br/>
                    ${escapeHtml(
                    satellite.school,
                )}<br/>
                    ${satellite.temperature}°C
                    ·
                    ${satellite.humidity}% RH
                `,
                {
                    direction: "top",

                    offset: [0, -8],

                    sticky: true,
                },
            );
        }

        /*
         * Remove markers for satellites that
         * are no longer present.
         */
        markersRef.current.forEach(
            (marker, id) => {
                if (!currentIds.has(id)) {
                    marker.remove();

                    markersRef.current.delete(id);
                }
            },
        );
    }, [satellites]);

    /* =====================================================
       SELECTED SATELLITE
    ===================================================== */

    useEffect(() => {
        if (
            !mapRef.current ||
            !selectedSatellite
        ) {
            return;
        }

        if (
            !Number.isFinite(
                selectedSatellite.latitude,
            ) ||
            !Number.isFinite(
                selectedSatellite.longitude,
            )
        ) {
            return;
        }

        mapRef.current.flyTo(
            [
                selectedSatellite.latitude,
                selectedSatellite.longitude,
            ],
            9,
            {
                duration: 0.6,
            },
        );
    }, [selectedSatellite]);

    return (
        <div className="map-container">
            <div
                ref={mapElementRef}
                className="leaflet-map"
            />

            <div className="map-overlay">
                <div className="map-live">
                    <span className="live-dot" />
                    Live telemetry
                </div>

                <div className="map-count">
                    {satellites.length.toLocaleString()}{" "}
                    satellites
                </div>
            </div>
        </div>
    );
}

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
    value: string,
): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   MAIN DASHBOARD
========================================================= */

export default function SatelliteDashboard() {
    const [satellites, setSatellites] =
        useState<Satellite[]>([]);

    const [statusCheckTime, setStatusCheckTime] =
        useState(() => Date.now());

    const [selectedSatellite, setSelectedSatellite] =
        useState<Satellite | null>(null);

    const [search, setSearch] =
        useState("");

    const [activeView, setActiveView] =
        useState<
            "overview" | "directory"
        >("overview");

    const [darkMode, setDarkMode] =
        useState(false);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [lastUpdated, setLastUpdated] =
        useState<Date | null>(null);

    const [directoryPage, setDirectoryPage] =
        useState(1);

    const statusCheckedSatellites =
        useMemo(
            () =>
                satellites.map((satellite) => ({
                    ...satellite,
                    status: DEMO_MODE
                        ? satellite.status
                        : getTelemetryStatus(
                            satellite.timestamp,
                            statusCheckTime,
                        ),
                })),
            [satellites, statusCheckTime],
        );

    useEffect(() => {
        const interval =
            window.setInterval(() => {
                setStatusCheckTime(Date.now());
            }, 1000);

        return () => {
            window.clearInterval(interval);
        };
    }, []);

    /*
     * Prevents too many React state updates.
     */
    const pendingUpdateRef =
        useRef<Satellite[] | null>(null);

    const updateTimerRef =
        useRef<number | null>(null);

    /* =====================================================
       THROTTLED STATE UPDATE
    ===================================================== */

    const scheduleSatelliteUpdate =
        useCallback(
            (data: Satellite[]) => {
                pendingUpdateRef.current =
                    data;

                if (
                    updateTimerRef.current !==
                    null
                ) {
                    return;
                }

                updateTimerRef.current =
                    window.setTimeout(() => {
                        const pending =
                            pendingUpdateRef.current;

                        if (pending) {
                            setSatellites(
                                pending,
                            );

                            pendingUpdateRef.current =
                                null;
                        }

                        updateTimerRef.current =
                            null;
                    }, FRONTEND_UPDATE_THROTTLE);
            },
            [],
        );

    /* =====================================================
       LOAD TELEMETRY
    ===================================================== */

    const loadTelemetry =
        useCallback(
            async (
                showLoader = false,
            ) => {
                try {
                    if (showLoader) {
                        setLoading(true);
                    }

                    setError(null);

                    /*
                     * Demo mode is only for UI testing.
                     */
                    if (DEMO_MODE) {
                        const data =
                            createDemoSatellites();

                        scheduleSatelliteUpdate(
                            data,
                        );

                        setLastUpdated(
                            new Date(),
                        );

                        return;
                    }

                    const response =
                        await fetch(
                            TELEMETRY_API,
                            {
                                method: "GET",

                                credentials:
                                    "include",

                                headers: {
                                    Accept:
                                        "application/json",
                                },

                                cache: "no-store",
                            },
                        );

                    if (!response.ok) {
                        throw new Error(
                            `Telemetry API returned ${response.status}`,
                        );
                    }

                    const json =
                        await response.json();

                    const rawData =
                        extractTelemetryArray(
                            json,
                        );

                    const normalized =
                        rawData.map(
                            (
                                item,
                                index,
                            ) =>
                                normalizeSatellite(
                                    item,
                                    index,
                                ),
                        );

                    scheduleSatelliteUpdate(
                        normalized,
                    );

                    setLastUpdated(
                        new Date(),
                    );
                } catch (err) {
                    console.error(
                        "Telemetry API error:",
                        err,
                    );

                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load telemetry.",
                    );
                } finally {
                    if (showLoader) {
                        setLoading(false);
                    }
                }
            },
            [
                scheduleSatelliteUpdate,
            ],
        );

    /* =====================================================
       INITIAL LOAD + POLLING
    ===================================================== */

    useEffect(() => {
        loadTelemetry(true);

        const interval =
            window.setInterval(() => {
                loadTelemetry(false);
            }, POLL_INTERVAL);

        return () => {
            window.clearInterval(
                interval,
            );

            if (
                updateTimerRef.current !==
                null
            ) {
                window.clearTimeout(
                    updateTimerRef.current,
                );
            }
        };
    }, [loadTelemetry]);

    /* =====================================================
       FILTERING
    ===================================================== */

    const filteredSatellites =
        useMemo(() => {
            const value =
                search
                    .trim()
                    .toLowerCase();

            if (!value) {
                return statusCheckedSatellites;
            }

            return statusCheckedSatellites.filter(
                (satellite) =>
                    satellite.id
                        .toLowerCase()
                        .includes(value) ||
                    satellite.name
                        .toLowerCase()
                        .includes(value) ||
                    satellite.school
                        .toLowerCase()
                        .includes(value) ||
                    satellite.student
                        .toLowerCase()
                        .includes(value) ||
                    satellite.location
                        .toLowerCase()
                        .includes(value),
            );
        }, [statusCheckedSatellites, search]);

    /* =====================================================
       DIRECTORY PAGINATION
    ===================================================== */

    const directoryTotalPages =
        Math.max(
            1,
            Math.ceil(
                filteredSatellites.length /
                DIRECTORY_PAGE_SIZE,
            ),
        );

    const directoryStartIndex =
        (directoryPage - 1) *
        DIRECTORY_PAGE_SIZE;

    const directorySatellites =
        filteredSatellites.slice(
            directoryStartIndex,
            directoryStartIndex +
            DIRECTORY_PAGE_SIZE,
        );

    useEffect(() => {
        setDirectoryPage(1);
    }, [search]);

    /* =====================================================
       STATISTICS
    ===================================================== */

    const onlineCount =
        statusCheckedSatellites.filter(
            (satellite) =>
                satellite.status ===
                "online",
        ).length;

    const warningCount =
        statusCheckedSatellites.filter(
            (satellite) =>
                satellite.status ===
                "warning",
        ).length;

    const offlineCount =
        statusCheckedSatellites.filter(
            (satellite) =>
                satellite.status ===
                "offline",
        ).length;

    const averageTemperature =
        statusCheckedSatellites.length > 0
            ? statusCheckedSatellites.reduce(
                (
                    total,
                    satellite,
                ) =>
                    total +
                    satellite.temperature,
                0,
            ) / statusCheckedSatellites.length
            : 0;

    const averageHumidity =
        statusCheckedSatellites.length > 0
            ? statusCheckedSatellites.reduce(
                (
                    total,
                    satellite,
                ) =>
                    total +
                    satellite.humidity,
                0,
            ) / statusCheckedSatellites.length
            : 0;

    const averagePressure =
        statusCheckedSatellites.length > 0
            ? statusCheckedSatellites.reduce(
                (
                    total,
                    satellite,
                ) =>
                    total +
                    satellite.pressure,
                0,
            ) / statusCheckedSatellites.length
            : 0;

    const averageAltitude =
        statusCheckedSatellites.length > 0
            ? statusCheckedSatellites.reduce(
                (
                    total,
                    satellite,
                ) =>
                    total +
                    satellite.altitude,
                0,
            ) / statusCheckedSatellites.length
            : 0;

    /* =====================================================
       CURRENT SATELLITE
    ===================================================== */

    const currentSatellite =
        statusCheckedSatellites.find(
            (satellite) =>
                satellite.id === selectedSatellite?.id,
        ) ??
        statusCheckedSatellites[0] ??
        null;

    /* =====================================================
       SATELLITE NAVIGATION
    ===================================================== */

    const changeSatellite =
        useCallback(
            (
                direction:
                    | "next"
                    | "previous",
            ) => {
                if (
                    statusCheckedSatellites.length ===
                    0 ||
                    !currentSatellite
                ) {
                    return;
                }

                const index =
                    statusCheckedSatellites.findIndex(
                        (satellite) =>
                            satellite.id ===
                            currentSatellite.id,
                    );

                if (index === -1) {
                    return;
                }

                const nextIndex =
                    direction === "next"
                        ? (index + 1) %
                        statusCheckedSatellites.length
                        : (index -
                            1 +
                            statusCheckedSatellites.length) %
                        statusCheckedSatellites.length;

                setSelectedSatellite(
                    statusCheckedSatellites[nextIndex],
                );
            },
            [
                statusCheckedSatellites,
                currentSatellite,
            ],
        );

    /* =====================================================
       STYLES
    ===================================================== */

    return (
        <div
            className={
                darkMode
                    ? "dashboard dark"
                    : "dashboard"
            }
        >
            <style>{`
                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    font-family:
                        Inter,
                        ui-sans-serif,
                        system-ui,
                        -apple-system,
                        BlinkMacSystemFont,
                        "Segoe UI",
                        sans-serif;

                    background: #f5f7fa;
                }

                button,
                input {
                    font: inherit;
                }

                button {
                    cursor: pointer;
                }

                .dashboard {
                    min-height: 100vh;
                    background: #f5f7fa;
                    color: #182230;
                }

                .dashboard.dark {
                    background: #111827;
                    color: #f3f4f6;
                }

                /* HEADER */

                .header {
                    background: #ffffff;
                    border-bottom: 1px solid #dfe5ec;
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                }

                .dark .header {
                    background: #172033;
                    border-color: #293449;
                }

                .header-inner {
                    max-width: 1400px;
                    margin: auto;
                    padding: 14px 22px;

                    display: flex;
                    align-items: center;
                    justify-content: space-between;

                    gap: 20px;
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                }

                .brand-icon {
                    width: 44px;
                    height: 44px;

                    border-radius: 10px;

                    background: #edf4ff;
                    color: #1769e0;

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    flex-shrink: 0;
                }

                .dark .brand-icon {
                    background: #1e355a;
                }

                .brand-title {
                    font-size: clamp(
                        19px,
                        2vw,
                        27px
                    );

                    font-weight: 800;
                    letter-spacing: -0.6px;
                }

                .brand-subtitle {
                    color: #687386;
                    font-size: 12px;
                    margin-top: 3px;
                }

                .dark .brand-subtitle {
                    color: #aeb9c9;
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .icon-button {
                    border: 1px solid #ccd5e1;
                    background: #ffffff;
                    color: #263346;

                    border-radius: 9px;

                    width: 40px;
                    height: 40px;

                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .dark .icon-button {
                    background: #202b3e;
                    color: #e5e7eb;
                    border-color: #37445a;
                }

                .icon-button:hover {
                    background: #f1f5f9;
                }

                .dark .icon-button:hover {
                    background: #29364b;
                }

                .mobile-menu-button {
                    display: none;
                }

                /* NAV */

                .nav {
                    max-width: 1400px;
                    margin: auto;

                    padding: 0 22px 12px;

                    display: flex;
                    gap: 8px;
                }

                .nav-button {
                    border: 1px solid #cfd8e4;
                    background: #f7f9fc;
                    color: #344054;

                    border-radius: 9px;

                    padding: 9px 14px;

                    display: flex;
                    align-items: center;
                    gap: 7px;

                    font-size: 13px;
                    font-weight: 650;
                }

                .dark .nav-button {
                    background: #202b3e;
                    border-color: #37445a;
                    color: #d7deea;
                }

                .nav-button.active {
                    background: #1769e0;
                    color: white;
                    border-color: #1769e0;
                }

                .live-status {
                    margin-left: auto;

                    border: 1px solid #78d7ad;
                    color: #087443;
                    background: #e8fbf3;

                    border-radius: 999px;

                    padding: 7px 12px;

                    font-size: 12px;
                    font-weight: 700;

                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .live-dot {
                    width: 7px;
                    height: 7px;

                    background: #12a76c;
                    border-radius: 50%;

                    display: inline-block;
                }

                /* MAIN */

                .main {
                    max-width: 1400px;
                    margin: auto;
                    padding: 22px;
                }

                .top-grid {
                    display: grid;
                    grid-template-columns:
                        1fr 1fr;

                    gap: 16px;

                    margin-bottom: 16px;
                }

                .card {
                    background: #ffffff;
                    border: 1px solid #dce3eb;
                    border-radius: 14px;

                    box-shadow:
                        0 2px 8px
                        rgba(
                            20,
                            40,
                            70,
                            0.04
                        );
                }

                .dark .card {
                    background: #172033;
                    border-color: #293449;
                    box-shadow: none;
                }

                /* NETWORK */

                .network-card {
                    padding: 20px;
                    border-left: 4px solid #1769e0;
                }

                .card-label {
                    display: flex;
                    align-items: center;
                    gap: 7px;

                    color: #1769e0;

                    font-size: 12px;
                    font-weight: 800;

                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                .network-number {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;

                    margin-top: 8px;
                }

                .network-number strong {
                    font-size: 44px;
                    line-height: 1;
                    color: #1769e0;
                }

                .network-number span {
                    color: #677489;
                    font-size: 17px;
                    font-weight: 700;
                }

                .network-line {
                    height: 1px;
                    background: #e5e9ef;
                    margin: 15px 0;
                }

                .dark .network-line {
                    background: #2b374b;
                }

                .network-footer {
                    display: flex;
                    justify-content: space-between;

                    gap: 10px;

                    color: #647184;
                    font-size: 12px;
                }

                /* CURRENT */

                .current-card {
                    padding: 20px;
                    border-left: 4px solid #f0a900;
                }

                .current-top {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                }

                .current-badge {
                    background: #fff3cc;
                    color: #925d00;

                    border: 1px solid #f1cf6a;
                    border-radius: 999px;

                    padding: 5px 9px;

                    font-size: 11px;
                    font-weight: 750;
                }

                .dark .current-badge {
                    background: #463713;
                    color: #f6d87c;
                    border-color: #67531e;
                }

                .current-name {
                    margin-top: 12px;

                    font-size: 25px;
                    font-weight: 800;
                }

                .current-school {
                    color: #697586;
                    font-size: 12px;
                    margin-top: 4px;
                }

                .dark .current-school {
                    color: #abb6c8;
                }

                .current-reading {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;

                    margin-top: 12px;
                }

                .temperature {
                    font-size: 30px;
                    font-weight: 800;
                    color: #a55b00;
                }

                .humidity {
                    font-size: 12px;
                    color: #687386;
                }

                .current-controls {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;

                    margin-top: 15px;
                    gap: 8px;
                }

                .small-button {
                    border: 1px solid #d4dce6;
                    background: #f8fafc;
                    color: #344054;

                    border-radius: 8px;

                    padding: 7px 11px;

                    display: flex;
                    align-items: center;
                    gap: 5px;

                    font-size: 12px;
                    font-weight: 650;
                }

                .dark .small-button {
                    background: #202b3e;
                    border-color: #37445a;
                    color: #d8dfeb;
                }

                .small-button.primary {
                    background: #f0a900;
                    color: #382300;
                    border-color: #f0a900;
                }

                /* METRICS */

                .metrics {
                    display: grid;

                    grid-template-columns:
                        repeat(4, 1fr);

                    gap: 16px;

                    margin-bottom: 18px;
                }

                .metric {
                    padding: 17px;
                    border-top: 3px solid #1769e0;
                }

                .metric.temperature-card {
                    border-top-color: #dc3545;
                }

                .metric.humidity-card {
                    border-top-color: #2388c8;
                }

                .metric.pressure-card {
                    border-top-color: #15956b;
                }

                .metric.altitude-card {
                    border-top-color: #7c3aed;
                }

                .metric-label {
                    display: flex;
                    align-items: center;
                    gap: 7px;

                    color: #687386;

                    font-size: 11px;
                    font-weight: 800;

                    text-transform: uppercase;
                }

                .metric-value {
                    margin-top: 9px;

                    font-size: 27px;
                    font-weight: 800;
                }

                .metric-note {
                    color: #7a8698;
                    font-size: 11px;
                    margin-top: 4px;
                }

                /* CONTENT */

                .content-grid {
                    display: grid;

                    grid-template-columns:
                        minmax(0, 1.15fr)
                        minmax(340px, 0.85fr);

                    gap: 18px;
                }

                .section-card {
                    padding: 18px;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;

                    gap: 10px;

                    padding-bottom: 14px;

                    border-bottom:
                        1px solid #e4e8ee;
                }

                .dark .section-header {
                    border-color: #2b374b;
                }

                .section-title {
                    display: flex;
                    align-items: center;

                    gap: 9px;

                    font-size: 17px;
                    font-weight: 800;
                }

                .section-description {
                    color: #778396;
                    font-size: 11px;
                    margin-top: 3px;
                }

                .section-actions {
                    display: flex;
                    gap: 6px;
                }

                /* MAP */

                .map-container {
                    height: 500px;

                    margin-top: 15px;

                    position: relative;

                    overflow: hidden;

                    border-radius: 11px;

                    border:
                        1px solid #dbe2ea;
                }

                .leaflet-map {
                    width: 100%;
                    height: 100%;
                }

                .map-overlay {
                    position: absolute;

                    left: 12px;
                    top: 12px;

                    z-index: 500;

                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .map-live,
                .map-count {
                    background:
                        rgba(
                            255,
                            255,
                            255,
                            0.94
                        );

                    border:
                        1px solid #d8e0e8;

                    border-radius: 7px;

                    padding: 7px 9px;

                    font-size: 11px;
                    font-weight: 700;

                    box-shadow:
                        0 2px 6px
                        rgba(
                            0,
                            0,
                            0,
                            0.08
                        );
                }

                .map-live {
                    display: flex;
                    align-items: center;
                    gap: 6px;

                    color: #087443;
                }

                .satellite-marker-wrapper {
                    background: transparent;
                    border: 0;
                }

                .satellite-marker {
                    width: 18px;
                    height: 18px;

                    border-radius: 50%;

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    border: 2px solid white;

                    box-shadow:
                        0 1px 6px
                        rgba(
                            0,
                            0,
                            0,
                            0.25
                        );
                }

                .satellite-marker-dot {
                    width: 7px;
                    height: 7px;

                    border-radius: 50%;

                    background: white;
                }

                .satellite-marker.online {
                    background: #12a76c;
                }

                .satellite-marker.warning {
                    background: #e69a00;
                }

                .satellite-marker.offline {
                    background: #d63b4b;
                }

                /* SEARCH */

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 8px;

                    border:
                        1px solid #cfd8e4;

                    background: #ffffff;

                    border-radius: 9px;

                    padding: 8px 10px;

                    margin: 15px 0;
                }

                .dark .search-box {
                    background: #202b3e;
                    border-color: #37445a;
                }

                .search-box input {
                    border: 0;
                    outline: 0;

                    background: transparent;

                    width: 100%;

                    color: inherit;

                    font-size: 13px;
                }

                /* LIST */

                .satellite-list {
                    display: flex;
                    flex-direction: column;

                    gap: 8px;

                    max-height: 500px;

                    overflow-y: auto;

                    padding-right: 3px;
                }

                .satellite-item {
                    width: 100%;

                    text-align: left;

                    border:
                        1px solid #e0e5eb;

                    background: #fafbfd;

                    border-radius: 10px;

                    padding: 11px;

                    color: inherit;
                }

                .dark .satellite-item {
                    background: #1d293b;
                    border-color: #2f3b50;
                }

                .satellite-item:hover,
                .satellite-item.selected {
                    border-color: #1769e0;
                    background: #f1f6ff;
                }

                .dark .satellite-item:hover,
                .dark .satellite-item.selected {
                    background: #1d355b;
                }

                .satellite-item-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;

                    gap: 8px;
                }

                .satellite-id {
                    color: #1769e0;

                    font-size: 12px;
                    font-weight: 800;
                }

                .status {
                    display: flex;
                    align-items: center;
                    gap: 5px;

                    font-size: 10px;
                    font-weight: 750;
                }

                .status-dot {
                    width: 7px;
                    height: 7px;

                    border-radius: 50%;
                }

                .status.online {
                    color: #087443;
                }

                .status.online .status-dot {
                    background: #12a76c;
                }

                .status.warning {
                    color: #a56500;
                }

                .status.warning .status-dot {
                    background: #e69a00;
                }

                .status.offline {
                    color: #b42336;
                }

                .status.offline .status-dot {
                    background: #d63b4b;
                }

                .satellite-name {
                    margin-top: 6px;

                    font-size: 13px;
                    font-weight: 750;
                }

                .satellite-school {
                    margin-top: 3px;

                    color: #687386;

                    font-size: 11px;

                    white-space: nowrap;

                    overflow: hidden;

                    text-overflow: ellipsis;
                }

                .dark .satellite-school {
                    color: #aeb9c9;
                }

                .satellite-readings {
                    display: grid;

                    grid-template-columns:
                        repeat(3, 1fr);

                    gap: 6px;

                    margin-top: 9px;

                    padding-top: 8px;

                    border-top:
                        1px solid #e4e8ee;
                }

                .dark .satellite-readings {
                    border-color: #2f3b50;
                }

                .reading {
                    font-size: 10px;
                    color: #778396;
                }

                .reading strong {
                    display: block;

                    color: inherit;

                    font-size: 12px;

                    margin-top: 2px;
                }

                /* DETAILS */

                .details-panel {
                    margin-top: 15px;

                    padding: 15px;

                    border:
                        1px solid #dce3eb;

                    border-radius: 10px;

                    background: #f8fafc;
                }

                .dark .details-panel {
                    background: #1d293b;
                    border-color: #334155;
                }

                .details-header {
                    display: flex;
                    justify-content: space-between;

                    gap: 10px;
                }

                .details-title {
                    font-size: 16px;
                    font-weight: 800;
                }

                .details-grid {
                    display: grid;

                    grid-template-columns:
                        repeat(3, 1fr);

                    gap: 10px;

                    margin-top: 13px;
                }

                .detail-box {
                    background: #ffffff;

                    border:
                        1px solid #e1e6ec;

                    border-radius: 8px;

                    padding: 9px;
                }

                .dark .detail-box {
                    background: #172033;
                    border-color: #334155;
                }

                .detail-label {
                    color: #788496;
                    font-size: 10px;
                }

                .detail-value {
                    margin-top: 3px;

                    font-size: 14px;
                    font-weight: 750;
                }

                /* DIRECTORY */

                .directory-page {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }

                .directory-toolbar {
                    display: flex;
                    justify-content: space-between;

                    align-items: center;

                    gap: 10px;
                }

                .directory-grid {
                    display: grid;

                    grid-template-columns:
                        repeat(3, 1fr);

                    gap: 12px;
                }

                .directory-pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;

                    gap: 10px;

                    margin-top: 18px;
                }

                .page-info {
                    color: #687386;

                    font-size: 12px;
                    font-weight: 650;
                }

                /* ERROR */

                .error-box {
                    margin-bottom: 16px;

                    padding: 12px 14px;

                    border:
                        1px solid #efb1ba;

                    background: #fff2f3;

                    color: #9d1c2d;

                    border-radius: 10px;

                    font-size: 12px;

                    display: flex;

                    justify-content: space-between;

                    align-items: center;

                    gap: 10px;
                }

                .dark .error-box {
                    background: #3a2027;
                    border-color: #71313d;
                    color: #ffb7c1;
                }

                /* LOADING */

                .loading-box {
                    padding: 40px 20px;

                    text-align: center;

                    color: #687386;

                    font-size: 13px;
                }

                /* FOOTER */

                .footer {
                    max-width: 1400px;

                    margin: auto;

                    padding:
                        20px 22px 28px;

                    display: flex;

                    justify-content:
                        space-between;

                    gap: 10px;

                    color: #778396;

                    font-size: 11px;
                }

                /* RESPONSIVE */

                @media (max-width: 1100px) {
                    .content-grid {
                        grid-template-columns: 1fr;
                    }

                    .directory-grid {
                        grid-template-columns:
                            repeat(2, 1fr);
                    }
                }

                @media (max-width: 800px) {
                    .header-inner {
                        padding:
                            12px 15px;
                    }

                    .main {
                        padding: 15px;
                    }

                    .top-grid {
                        grid-template-columns:
                            1fr;
                    }

                    .metrics {
                        grid-template-columns:
                            repeat(2, 1fr);
                    }

                    .nav {
                        padding:
                            0 15px 10px;

                        overflow-x: auto;
                    }

                    .nav-button {
                        white-space: nowrap;
                    }

                    .live-status {
                        display: none;
                    }

                    .map-container {
                        height: 420px;
                    }
                }

                @media (max-width: 560px) {
                    .brand-icon {
                        width: 38px;
                        height: 38px;
                    }

                    .brand-subtitle {
                        display: none;
                    }

                    .header-actions
                        .download-button {
                        display: none;
                    }

                    .mobile-menu-button {
                        display: flex;
                    }

                    .metrics {
                        grid-template-columns:
                            1fr;
                    }

                    .directory-grid {
                        grid-template-columns:
                            1fr;
                    }

                    .network-number strong {
                        font-size: 38px;
                    }

                    .map-container {
                        height: 360px;
                    }

                    .details-grid {
                        grid-template-columns:
                            repeat(2, 1fr);
                    }

                    .footer {
                        flex-direction: column;
                    }
                }
            `}</style>

            {/* =================================================
                HEADER
            ================================================= */}

            <header className="header">
                <div className="header-inner">
                    <div className="brand">
                        <div className="brand-icon">
                            <Satellite
                                size={24}
                            />
                        </div>

                        <div>
                            <div className="brand-title">
                                PROJECT
                                ANTRIKSHA
                            </div>

                            <div className="brand-subtitle">
                                ISRO IndoScience
                                Student
                                Micro-Satellite
                                Telemetry
                                Network
                            </div>
                        </div>
                    </div>

                    <div className="header-actions">
                        <button
                            className="icon-button download-button"
                            onClick={() =>
                                downloadCSV(
                                    filteredSatellites,
                                )
                            }
                            title="Download telemetry"
                        >
                            <Download
                                size={17}
                            />
                        </button>

                        <button
                            className="icon-button"
                            onClick={() =>
                                setDarkMode(
                                    (value) =>
                                        !value,
                                )
                            }
                            title="Change appearance"
                        >
                            {darkMode ? (
                                <Sun
                                    size={17}
                                />
                            ) : (
                                <Moon
                                    size={17}
                                />
                            )}
                        </button>

                        <button
                            className="icon-button mobile-menu-button"
                            onClick={() =>
                                setActiveView(
                                    activeView ===
                                        "overview"
                                        ? "directory"
                                        : "overview",
                                )
                            }
                        >
                            <Menu
                                size={19}
                            />
                        </button>
                    </div>
                </div>

                <nav className="nav">
                    <button
                        className={
                            activeView ===
                                "overview"
                                ? "nav-button active"
                                : "nav-button"
                        }
                        onClick={() =>
                            setActiveView(
                                "overview",
                            )
                        }
                    >
                        <LayoutDashboard
                            size={15}
                        />
                        Dashboard
                    </button>

                    <button
                        className={
                            activeView ===
                                "directory"
                                ? "nav-button active"
                                : "nav-button"
                        }
                        onClick={() =>
                            setActiveView(
                                "directory",
                            )
                        }
                    >
                        <Satellite
                            size={15}
                        />
                        Satellite Directory
                    </button>

                    <button
                        className="nav-button"
                        onClick={() => {
                            setActiveView(
                                "overview",
                            );

                            window.setTimeout(
                                () => {
                                    document
                                        .getElementById(
                                            "radar-map",
                                        )
                                        ?.scrollIntoView(
                                            {
                                                behavior:
                                                    "smooth",
                                            },
                                        );
                                },
                                50,
                            );
                        }}
                    >
                        <MapIcon size={18} />
                        Radar Map
                    </button>

                    <div className="live-status">
                        <span className="live-dot" />

                        {error
                            ? "Connection issue"
                            : "Live Ground Feed"}
                    </div>
                </nav>
            </header>

            {/* =================================================
                MAIN
            ================================================= */}

            <main className="main">
                {error && (
                    <div className="error-box">
                        <span>
                            Unable to load
                            telemetry:{" "}
                            {error}
                        </span>

                        <button
                            className="small-button"
                            onClick={() =>
                                loadTelemetry(
                                    true,
                                )
                            }
                        >
                            <RefreshCw
                                size={13}
                            />
                            Retry
                        </button>
                    </div>
                )}

                {activeView ===
                    "overview" ? (
                    <>
                        {/* TOP CARDS */}

                        <div className="top-grid">
                            <section className="card network-card">
                                <div className="card-label">
                                    <Globe2
                                        size={14}
                                    />
                                    Total Ground
                                    Satellites
                                </div>

                                <div className="network-number">
                                    <strong>
                                        {onlineCount.toLocaleString()}
                                    </strong>

                                    <span>
                                        /{" "}
                                        {TOTAL_SATELLITES.toLocaleString()}
                                    </span>
                                </div>

                                <div className="network-line" />

                                <div className="network-footer">
                                    <span>
                                        {onlineCount.toLocaleString()}{" "}
                                        reporting
                                    </span>

                                    <span>
                                        {
                                            warningCount
                                        }{" "}
                                        warning ·{" "}
                                        {
                                            offlineCount
                                        }{" "}
                                        offline
                                    </span>
                                </div>
                            </section>

                            <section className="card current-card">
                                <div className="current-top">
                                    <div className="card-label">
                                        <Signal
                                            size={14}
                                        />
                                        Live
                                        Satellite
                                    </div>

                                    {currentSatellite && (
                                        <div className="current-badge">
                                            {currentSatellite.status.toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                {loading &&
                                    !currentSatellite ? (
                                    <div className="loading-box">
                                        Loading
                                        telemetry...
                                    </div>
                                ) : currentSatellite ? (
                                    <>
                                        <div className="current-name">
                                            {
                                                currentSatellite.name
                                            }
                                        </div>

                                        <div className="current-school">
                                            {
                                                currentSatellite.school
                                            }
                                        </div>

                                        <div className="current-reading">
                                            <div className="temperature">
                                                {
                                                    currentSatellite.temperature
                                                }
                                                °C
                                            </div>

                                            <div className="humidity">
                                                💧{" "}
                                                {
                                                    currentSatellite.humidity
                                                }
                                                % RH
                                            </div>
                                        </div>

                                        <div className="current-controls">
                                            <button
                                                className="small-button"
                                                onClick={() =>
                                                    changeSatellite(
                                                        "previous",
                                                    )
                                                }
                                            >
                                                <ChevronLeft
                                                    size={
                                                        14
                                                    }
                                                />
                                            </button>

                                            <button
                                                className="small-button primary"
                                                onClick={() =>
                                                    setActiveView(
                                                        "directory",
                                                    )
                                                }
                                            >
                                                View
                                                satellite
                                            </button>

                                            <button
                                                className="small-button"
                                                onClick={() =>
                                                    changeSatellite(
                                                        "next",
                                                    )
                                                }
                                            >
                                                <ChevronRight
                                                    size={
                                                        14
                                                    }
                                                />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="loading-box">
                                        No satellite
                                        data
                                        available.
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* METRICS */}

                        <div className="metrics">
                            <section className="card metric temperature-card">
                                <div className="metric-label">
                                    <Thermometer
                                        size={14}
                                    />
                                    Average
                                    Temperature
                                </div>

                                <div className="metric-value">
                                    {averageTemperature.toFixed(
                                        1,
                                    )}
                                    °C
                                </div>

                                <div className="metric-note">
                                    Across
                                    telemetry
                                    records
                                </div>
                            </section>

                            <section className="card metric humidity-card">
                                <div className="metric-label">
                                    <Droplets
                                        size={14}
                                    />
                                    Average
                                    Humidity
                                </div>

                                <div className="metric-value">
                                    {averageHumidity.toFixed(
                                        1,
                                    )}
                                    %
                                </div>

                                <div className="metric-note">
                                    Air moisture
                                </div>
                            </section>

                            <section className="card metric pressure-card">
                                <div className="metric-label">
                                    <Gauge
                                        size={14}
                                    />
                                    Average
                                    Pressure
                                </div>

                                <div className="metric-value">
                                    {averagePressure.toFixed(
                                        1,
                                    )}{" "}
                                    hPa
                                </div>

                                <div className="metric-note">
                                    Atmospheric
                                    pressure
                                </div>
                            </section>

                            <section className="card metric altitude-card">
                                <div className="metric-label">
                                    <Navigation
                                        size={14}
                                    />
                                    Average
                                    Altitude
                                </div>

                                <div className="metric-value">
                                    {Math.round(
                                        averageAltitude,
                                    )}{" "}
                                    m
                                </div>

                                <div className="metric-note">
                                    Current
                                    altitude
                                </div>
                            </section>
                        </div>

                        {/* MAP + LIST */}

                        <div className="content-grid">
                            <section
                                className="card section-card"
                                id="radar-map"
                            >
                                <div className="section-header">
                                    <div>
                                        <div className="section-title">
                                            <MapIcon size={18} />
                                            Live
                                            Satellite
                                            Radar
                                        </div>

                                        <div className="section-description">
                                            Real-time
                                            satellite
                                            locations
                                            and
                                            telemetry
                                        </div>
                                    </div>

                                    <button
                                        className="small-button"
                                        onClick={() =>
                                            loadTelemetry(
                                                true,
                                            )
                                        }
                                    >
                                        <RefreshCw
                                            size={
                                                13
                                            }
                                        />

                                        <span>
                                            Refresh
                                        </span>
                                    </button>
                                </div>

                                <SatelliteMap
                                    satellites={
                                        statusCheckedSatellites
                                    }
                                    selectedSatellite={
                                        currentSatellite
                                    }
                                    onSelect={
                                        setSelectedSatellite
                                    }
                                />

                                {currentSatellite && (
                                    <div className="details-panel">
                                        <div className="details-header">
                                            <div>
                                                <div className="details-title">
                                                    {
                                                        currentSatellite.name
                                                    }
                                                </div>

                                                <div className="section-description">
                                                    {
                                                        currentSatellite.school
                                                    }
                                                </div>
                                            </div>

                                            <div
                                                className={`status ${currentSatellite.status}`}
                                            >
                                                <span className="status-dot" />

                                                {
                                                    currentSatellite.status
                                                }
                                            </div>
                                        </div>

                                        <div className="details-grid">
                                            <div className="detail-box">
                                                <div className="detail-label">
                                                    Temperature
                                                </div>

                                                <div className="detail-value">
                                                    {
                                                        currentSatellite.temperature
                                                    }
                                                    °C
                                                </div>
                                            </div>

                                            <div className="detail-box">
                                                <div className="detail-label">
                                                    Humidity
                                                </div>

                                                <div className="detail-value">
                                                    {
                                                        currentSatellite.humidity
                                                    }
                                                    %
                                                </div>
                                            </div>

                                            <div className="detail-box">
                                                <div className="detail-label">
                                                    Pressure
                                                </div>

                                                <div className="detail-value">
                                                    {
                                                        currentSatellite.pressure
                                                    }{" "}
                                                    hPa
                                                </div>
                                            </div>

                                            <div className="detail-box">
                                                <div className="detail-label">
                                                    Altitude
                                                </div>

                                                <div className="detail-value">
                                                    {
                                                        currentSatellite.altitude
                                                    }{" "}
                                                    m
                                                </div>
                                            </div>

                                            <div className="detail-box">
                                                <div className="detail-label">
                                                    Battery
                                                </div>

                                                <div className="detail-value">
                                                    {
                                                        currentSatellite.battery
                                                    }
                                                    %
                                                </div>
                                            </div>

                                            <div className="detail-box">
                                                <div className="detail-label">
                                                    Updated
                                                </div>

                                                <div className="detail-value">
                                                    {new Date(
                                                        currentSatellite.timestamp,
                                                    ).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section className="card section-card">
                                <div className="section-header">
                                    <div>
                                        <div className="section-title">
                                            <Satellite
                                                size={
                                                    18
                                                }
                                            />
                                            Satellite
                                            Directory
                                        </div>

                                        <div className="section-description">
                                            {
                                                filteredSatellites.length
                                            }{" "}
                                            satellites
                                        </div>
                                    </div>

                                    <button
                                        className="small-button"
                                        onClick={() =>
                                            setActiveView(
                                                "directory",
                                            )
                                        }
                                    >
                                        View all
                                    </button>
                                </div>

                                <div className="search-box">
                                    <Search
                                        size={
                                            16
                                        }
                                        color="#788496"
                                    />

                                    <input
                                        value={
                                            search
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            setSearch(
                                                event
                                                    .target
                                                    .value,
                                            )
                                        }
                                        placeholder="Search satellite, school or student"
                                    />
                                </div>

                                <div className="satellite-list">
                                    {filteredSatellites
                                        .slice(
                                            0,
                                            OVERVIEW_LIST_SIZE,
                                        )
                                        .map(
                                            (
                                                satellite,
                                            ) => (
                                                <button
                                                    key={
                                                        satellite.id
                                                    }
                                                    className={
                                                        currentSatellite?.id ===
                                                            satellite.id
                                                            ? "satellite-item selected"
                                                            : "satellite-item"
                                                    }
                                                    onClick={() =>
                                                        setSelectedSatellite(
                                                            satellite,
                                                        )
                                                    }
                                                >
                                                    <div className="satellite-item-top">
                                                        <span className="satellite-id">
                                                            {
                                                                satellite.id
                                                            }
                                                        </span>

                                                        <span
                                                            className={`status ${satellite.status}`}
                                                        >
                                                            <span className="status-dot" />
                                                            {
                                                                satellite.status
                                                            }
                                                        </span>
                                                    </div>

                                                    <div className="satellite-name">
                                                        {
                                                            satellite.name
                                                        }
                                                    </div>

                                                    <div className="satellite-school">
                                                        {
                                                            satellite.school
                                                        }
                                                    </div>

                                                    <div className="satellite-readings">
                                                        <div className="reading">
                                                            Temp

                                                            <strong>
                                                                {
                                                                    satellite.temperature
                                                                }
                                                                °C
                                                            </strong>
                                                        </div>

                                                        <div className="reading">
                                                            Humidity

                                                            <strong>
                                                                {
                                                                    satellite.humidity
                                                                }
                                                                %
                                                            </strong>
                                                        </div>

                                                        <div className="reading">
                                                            Altitude

                                                            <strong>
                                                                {
                                                                    satellite.altitude
                                                                }{" "}
                                                                m
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </button>
                                            ),
                                        )}
                                </div>
                            </section>
                        </div>
                    </>
                ) : (
                    /* =========================================
                       DIRECTORY
                    ========================================= */

                    <section className="directory-page">
                        <div className="card section-card">
                            <div className="directory-toolbar">
                                <div>
                                    <div className="section-title">
                                        <Satellite
                                            size={
                                                19
                                            }
                                        />
                                        All
                                        Satellites
                                    </div>

                                    <div className="section-description">
                                        {
                                            filteredSatellites.length
                                        }{" "}
                                        matching
                                        satellites
                                    </div>
                                </div>

                                <button
                                    className="small-button"
                                    onClick={() =>
                                        downloadCSV(
                                            filteredSatellites,
                                        )
                                    }
                                >
                                    <Download
                                        size={
                                            14
                                        }
                                    />
                                    Export
                                </button>
                            </div>

                            <div className="search-box">
                                <Search
                                    size={17}
                                    color="#788496"
                                />

                                <input
                                    value={
                                        search
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setSearch(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Search satellite, school, student or location"
                                />

                                {search && (
                                    <button
                                        className="icon-button"
                                        style={{
                                            minWidth: 28,
                                            width: 28,
                                            height: 28,
                                            border: 0,
                                        }}
                                        onClick={() =>
                                            setSearch(
                                                "",
                                            )
                                        }
                                    >
                                        <X
                                            size={
                                                15
                                            }
                                        />
                                    </button>
                                )}
                            </div>

                            <div className="directory-grid">
                                {directorySatellites.map(
                                    (
                                        satellite,
                                    ) => (
                                        <button
                                            key={
                                                satellite.id
                                            }
                                            className={
                                                currentSatellite?.id ===
                                                    satellite.id
                                                    ? "satellite-item selected"
                                                    : "satellite-item"
                                            }
                                            onClick={() => {
                                                setSelectedSatellite(
                                                    satellite,
                                                );

                                                setActiveView(
                                                    "overview",
                                                );
                                            }}
                                        >
                                            <div className="satellite-item-top">
                                                <span className="satellite-id">
                                                    {
                                                        satellite.id
                                                    }
                                                </span>

                                                <span
                                                    className={`status ${satellite.status}`}
                                                >
                                                    <span className="status-dot" />

                                                    {
                                                        satellite.status
                                                    }
                                                </span>
                                            </div>

                                            <div className="satellite-name">
                                                {
                                                    satellite.name
                                                }
                                            </div>

                                            <div className="satellite-school">
                                                {
                                                    satellite.school
                                                }
                                            </div>

                                            <div className="satellite-readings">
                                                <div className="reading">
                                                    Temp

                                                    <strong>
                                                        {
                                                            satellite.temperature
                                                        }
                                                        °C
                                                    </strong>
                                                </div>

                                                <div className="reading">
                                                    Humidity

                                                    <strong>
                                                        {
                                                            satellite.humidity
                                                        }
                                                        %
                                                    </strong>
                                                </div>

                                                <div className="reading">
                                                    Battery

                                                    <strong>
                                                        {
                                                            satellite.battery
                                                        }
                                                        %
                                                    </strong>
                                                </div>
                                            </div>
                                        </button>
                                    ),
                                )}
                            </div>

                            {/* PAGINATION */}

                            {directoryTotalPages >
                                1 && (
                                    <div className="directory-pagination">
                                        <button
                                            className="small-button"
                                            disabled={
                                                directoryPage ===
                                                1
                                            }
                                            onClick={() =>
                                                setDirectoryPage(
                                                    (
                                                        page,
                                                    ) =>
                                                        Math.max(
                                                            1,
                                                            page -
                                                            1,
                                                        ),
                                                )
                                            }
                                        >
                                            <ChevronLeft
                                                size={
                                                    14
                                                }
                                            />

                                            Previous
                                        </button>

                                        <span className="page-info">
                                            Page{" "}
                                            {
                                                directoryPage
                                            }{" "}
                                            of{" "}
                                            {
                                                directoryTotalPages
                                            }
                                        </span>

                                        <button
                                            className="small-button"
                                            disabled={
                                                directoryPage ===
                                                directoryTotalPages
                                            }
                                            onClick={() =>
                                                setDirectoryPage(
                                                    (
                                                        page,
                                                    ) =>
                                                        Math.min(
                                                            directoryTotalPages,
                                                            page +
                                                            1,
                                                        ),
                                                )
                                            }
                                        >
                                            Next

                                            <ChevronRight
                                                size={
                                                    14
                                                }
                                            />
                                        </button>
                                    </div>
                                )}
                        </div>
                    </section>
                )}
            </main>

            {/* FOOTER */}

            <footer className="footer">
                <span>
                    Project Antriksha · Live Ground
                    Telemetry
                </span>

                <span>
                    {lastUpdated
                        ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                        : "Waiting for telemetry"}
                </span>
            </footer>
        </div>
    );
}