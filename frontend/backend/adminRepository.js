const pool = require("./database");

/**
 * Find the single admin account by username.
 */
async function findAdminByUsername(username) {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            username,
            password_hash,
            is_active,
            created_at,
            updated_at
        FROM admins
        WHERE username = ?
        LIMIT 1
        `,
        [username]
    );

    return rows[0] || null;
}


/**
 * Find the single admin account by ID.
 */
async function findAdminById(id) {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            username,
            password_hash,
            is_active,
            created_at,
            updated_at
        FROM admins
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    );

    return rows[0] || null;
}


/**
 * Create the admin account.
 *
 * IMPORTANT:
 * passwordHash must already be generated using Argon2id.
 */
async function createAdmin({
    username,
    passwordHash,
}) {
    const [result] = await pool.execute(
        `
        INSERT INTO admins (
            username,
            password_hash
        )
        VALUES (?, ?)
        `,
        [
            username,
            passwordHash,
        ]
    );

    return findAdminById(result.insertId);
}


/**
 * Update the admin password hash.
 *
 * IMPORTANT:
 * passwordHash must already be generated using Argon2id.
 */
async function updateAdminPassword(
    adminId,
    passwordHash
) {
    const [result] = await pool.execute(
        `
        UPDATE admins
        SET password_hash = ?
        WHERE id = ?
        `,
        [
            passwordHash,
            adminId,
        ]
    );

    return result.affectedRows > 0;
}


/**
 * Activate or deactivate the admin account.
 */
async function setAdminActiveStatus(
    adminId,
    isActive
) {
    const [result] = await pool.execute(
        `
        UPDATE admins
        SET is_active = ?
        WHERE id = ?
        `,
        [
            isActive,
            adminId,
        ]
    );

    return result.affectedRows > 0;
}


module.exports = {
    findAdminByUsername,
    findAdminById,
    createAdmin,
    updateAdminPassword,
    setAdminActiveStatus,
};