const crypto = require("crypto");
const pool = require("./database");
const { hashPassword } = require("./password");


/**
 * Generate a secure random reset token.
 */
function generateResetToken() {
    return crypto.randomBytes(32).toString("hex");
}


/**
 * Hash reset token before storing it.
 */
function hashResetToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


/**
 * Create a password reset token.
 */
async function createPasswordResetToken({
    userType,
    userId,
    expiresInMinutes = 15,
}) {
    const token = generateResetToken();
    const tokenHash = hashResetToken(token);

    const expiresAt = new Date(
        Date.now() +
        expiresInMinutes * 60 * 1000
    );

    /*
     * Remove previous unused tokens
     * for this user.
     */
    await pool.execute(
        `
        DELETE FROM password_reset_tokens
        WHERE user_type = ?
          AND user_id = ?
          AND used_at IS NULL
        `,
        [userType, userId]
    );

    await pool.execute(
        `
        INSERT INTO password_reset_tokens (
            user_type,
            user_id,
            token_hash,
            expires_at
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            userType,
            userId,
            tokenHash,
            expiresAt,
        ]
    );

    return token;
}


/**
 * Find a valid reset token.
 */
async function findValidPasswordResetToken(token) {
    const tokenHash = hashResetToken(token);

    const [rows] = await pool.execute(
        `
        SELECT
            id,
            user_type,
            user_id,
            token_hash,
            expires_at,
            used_at,
            created_at
        FROM password_reset_tokens
        WHERE token_hash = ?
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
        `,
        [tokenHash]
    );

    return rows[0] || null;
}


/**
 * Mark reset token as used.
 */
async function markPasswordResetTokenUsed(tokenId) {
    const [result] = await pool.execute(
        `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE id = ?
          AND used_at IS NULL
        `,
        [tokenId]
    );

    return result.affectedRows > 0;
}


/**
 * Reset a user's password using a valid reset token.
 */
async function resetPassword({
    token,
    newPassword,
}) {
    if (!token || !newPassword) {
        throw new Error(
            "Reset token and new password are required."
        );
    }

    if (
        newPassword.length < 8 ||
        newPassword.length > 128
    ) {
        throw new Error(
            "Password must be between 8 and 128 characters."
        );
    }

    if (/\s/.test(newPassword)) {
        throw new Error(
            "Password must not contain spaces."
        );
    }

    /*
     * Find a valid, unused and non-expired token.
     */
    const resetRecord =
        await findValidPasswordResetToken(token);

    if (!resetRecord) {
        throw new Error(
            "Reset token is invalid or expired."
        );
    }

    /*
     * Hash the new password using Argon2id.
     */
    const passwordHash =
        await hashPassword(newPassword);

    /*
     * Update the correct user's password.
     */
    if (resetRecord.user_type === "school") {

        await pool.execute(
            `
            UPDATE schools
            SET password_hash = ?,
                updated_at = NOW()
            WHERE id = ?
            `,
            [
                passwordHash,
                resetRecord.user_id,
            ]
        );

    } else if (
        resetRecord.user_type === "student"
    ) {

        await pool.execute(
            `
            UPDATE students
            SET password_hash = ?,
                updated_at = NOW()
            WHERE id = ?
            `,
            [
                passwordHash,
                resetRecord.user_id,
            ]
        );

    } else {

        throw new Error(
            "Invalid reset account type."
        );
    }

    /*
     * Mark token as used.
     */
    await markPasswordResetTokenUsed(
        resetRecord.id
    );

    return {
        userType: resetRecord.user_type,
        userId: resetRecord.user_id,
    };
}


module.exports = {
    generateResetToken,
    hashResetToken,
    createPasswordResetToken,
    findValidPasswordResetToken,
    markPasswordResetTokenUsed,
    resetPassword,
};