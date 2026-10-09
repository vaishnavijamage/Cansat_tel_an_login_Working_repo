-- Telemetry database schema used by backend/telemetryStore.js and telemetryReadRoutes.js.
-- Run this against TELEMETRY_DB_NAME (not login_system).
CREATE DATABASE IF NOT EXISTS telemetry_system;
USE telemetry_system;

CREATE TABLE IF NOT EXISTS satellites (
    satellite_id VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    last_seen_at DATETIME(3) NULL,
    PRIMARY KEY (satellite_id),
    KEY idx_satellites_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS telemetry_packets (
    event_time DATETIME(3) NOT NULL,
    satellite_id VARCHAR(50) NOT NULL,
    packet_hash CHAR(64) NOT NULL,
    schema_version TINYINT UNSIGNED NOT NULL,
    received_at DATETIME(3) NOT NULL,
    altitude_msl DOUBLE NULL,
    altitude_agl DOUBLE NULL,
    temperature DOUBLE NULL,
    humidity DOUBLE NULL,
    pitch DOUBLE NULL,
    roll DOUBLE NULL,
    acceleration DOUBLE NULL,
    wifi_rssi DOUBLE NULL,
    PRIMARY KEY (event_time, satellite_id, packet_hash),
    KEY idx_telemetry_satellite_event (satellite_id, event_time),
    KEY idx_telemetry_received_at (received_at),
    CONSTRAINT fk_telemetry_packet_satellite
        FOREIGN KEY (satellite_id) REFERENCES satellites(satellite_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
