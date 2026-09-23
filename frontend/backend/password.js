const argon2 = require("argon2");

/**
 * Hash a password using Argon2id.
 */
async function hashPassword(password) {
    if (typeof password !== "string" || password.length === 0) {
        throw new Error("Password is required.");
    }

    return await argon2.hash(password, {
        type: argon2.argon2id,
    });
}

/**
 * Verify a plain password against an Argon2id hash.
 */
async function verifyPassword(password, passwordHash) {
    if (
        typeof password !== "string" ||
        typeof passwordHash !== "string" ||
        password.length === 0 ||
        passwordHash.length === 0
    ) {
        return false;
    }

    try {
        return await argon2.verify(passwordHash, password);
    } catch {
        return false;
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
};