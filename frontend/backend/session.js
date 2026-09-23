const crypto = require("crypto");
const pool = require("./database");

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a cryptographically secure session token.
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash the session token before storing it in MySQL.
 */
function hashSessionToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

/**
 * Create a new login session.
 */
async function createSession({ userId, userType }) {
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error("Invalid user ID.");
    }

    if (
        userType !== "admin" &&
        userType !== "school" &&
        userType !== "student"
    ) {
        throw new Error("Invalid user type.");
    }

    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);

    const expiresAt = new Date(
        Date.now() + SESSION_DURATION_MS
    );

    await pool.execute(
        `
        INSERT INTO sessions (
            user_type,
            user_id,
            session_token_hash,
            expires_at
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            userType,
            userId,
            sessionTokenHash,
            expiresAt,
        ]
    );

    return {
        sessionToken,
        expiresAt,
    };
}

/**
 * Find a valid session using the raw session token.
 */
async function getSession(sessionToken) {
    if (
        typeof sessionToken !== "string" ||
        !/^[a-f0-9]{64}$/.test(sessionToken)
    ) {
        return null;
    }

    const sessionTokenHash = hashSessionToken(sessionToken);

    const [rows] = await pool.execute(
        `
        SELECT
            id,
            user_type,
            user_id,
            expires_at,
            created_at
        FROM sessions
        WHERE session_token_hash = ?
          AND expires_at > NOW()
        LIMIT 1
        `,
        [sessionTokenHash]
    );

    return rows[0] || null;
}

/**
 * Delete a session.
 */
async function deleteSession(sessionToken) {
    if (
        typeof sessionToken !== "string" ||
        !/^[a-f0-9]{64}$/.test(sessionToken)
    ) {
        return false;
    }

    const sessionTokenHash = hashSessionToken(sessionToken);

    const [result] = await pool.execute(
        `
        DELETE FROM sessions
        WHERE session_token_hash = ?
        `,
        [sessionTokenHash]
    );

    return result.affectedRows > 0;
}

/**
 * Delete expired sessions.
 */
async function deleteExpiredSessions() {
    const [result] = await pool.execute(
        `
        DELETE FROM sessions
        WHERE expires_at <= NOW()
        `
    );

    return result.affectedRows;
}

/**
 * Revoke all sessions belonging to a user.
 */
async function deleteSessionsByUser(
    userId,
    userType
) {
    const [result] = await pool.execute(
        `
        DELETE FROM sessions
        WHERE user_id = ?
          AND user_type = ?
        `,
        [userId, userType]
    );

    return result.affectedRows;
}

module.exports = {
    createSession,
    getSession,
    deleteSession,
    deleteSessionsByUser,
};