USE login_system;

-- =========================================================
-- SCHOOLS
-- =========================================================

CREATE TABLE schools (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    school_name VARCHAR(150) NOT NULL,

    email VARCHAR(255) NOT NULL,

    phone VARCHAR(20) NOT NULL,

    password_hash VARCHAR(255) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_schools_email (email)
);


-- =========================================================
-- STUDENTS
-- =========================================================

CREATE TABLE students (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    school_id BIGINT UNSIGNED NOT NULL,

    student_name VARCHAR(150) NOT NULL,

    username VARCHAR(100) NOT NULL,

    password_hash VARCHAR(255) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_students_username (username),

    KEY idx_students_school_id (school_id),

    CONSTRAINT fk_students_school
        FOREIGN KEY (school_id)
        REFERENCES schools(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- =========================================================
-- SCHOOL MFA / TOTP
-- =========================================================

CREATE TABLE school_mfa (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    school_id BIGINT UNSIGNED NOT NULL,

    secret_encrypted TEXT NOT NULL,

    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_school_mfa_school (school_id),

    CONSTRAINT fk_school_mfa_school
        FOREIGN KEY (school_id)
        REFERENCES schools(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- =========================================================
-- LOGIN SESSIONS
-- =========================================================

CREATE TABLE sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_type ENUM('school', 'student') NOT NULL,

    user_id BIGINT UNSIGNED NOT NULL,

    session_token_hash CHAR(64) NOT NULL,

    expires_at DATETIME NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_sessions_token (session_token_hash),

    KEY idx_sessions_user (user_type, user_id),

    KEY idx_sessions_expires (expires_at)
);


-- =========================================================
-- PASSWORD RESET TOKENS
-- =========================================================

CREATE TABLE password_reset_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_type ENUM('school', 'student') NOT NULL,

    user_id BIGINT UNSIGNED NOT NULL,

    token_hash CHAR(64) NOT NULL,

    expires_at DATETIME NOT NULL,

    used_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_password_reset_token (token_hash),

    KEY idx_password_reset_user (user_type, user_id),

    KEY idx_password_reset_expires (expires_at)
);

CREATE TABLE satellites (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    satellite_id VARCHAR(50) NOT NULL,
    node_id VARCHAR(50) NOT NULL,
    satellite_name VARCHAR(150),
    student_id BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_satellite_id (satellite_id),
    UNIQUE KEY uq_node_id (node_id),

    CONSTRAINT fk_satellite_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE
);

CREATE TABLE satellite_telemetry (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    satellite_id VARCHAR(50) NOT NULL,
    node_id VARCHAR(50) NOT NULL,

    timestamp DATETIME NOT NULL,

    temperature DECIMAL(8,2),
    humidity DECIMAL(8,2),
    pressure DECIMAL(10,2),
    altitude DECIMAL(10,2),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    rssi INT,
    sequence_number BIGINT,

    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_telemetry_satellite_time
        (satellite_id, timestamp),

    INDEX idx_telemetry_node_time
        (node_id, timestamp)
);