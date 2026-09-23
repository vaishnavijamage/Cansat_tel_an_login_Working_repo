const {
    findAdminByUsername,
} = require("./adminRepository");

const {
    verifyPassword,
} = require("./password");


/**
 * Validate admin login input.
 */
function validateAdminLogin({
    username,
    password,
}) {
    if (
        typeof username !== "string" ||
        typeof password !== "string"
    ) {
        throw new Error(
            "Invalid username or password."
        );
    }

    const cleanUsername =
        username.trim().toLowerCase();

    if (!cleanUsername) {
        throw new Error(
            "Invalid username or password."
        );
    }

    if (
        !/^[a-z0-9_.-]{3,100}$/.test(
            cleanUsername
        )
    ) {
        throw new Error(
            "Invalid username or password."
        );
    }

    if (!password) {
        throw new Error(
            "Invalid username or password."
        );
    }

    return {
        username: cleanUsername,
        password,
    };
}


/**
 * Authenticate the admin.
 */
async function loginAdmin({
    username,
    password,
}) {
    const validated =
        validateAdminLogin({
            username,
            password,
        });

    const admin =
        await findAdminByUsername(
            validated.username
        );

    /*
     * Always return the same error to avoid
     * revealing whether the admin username exists.
     */
    if (!admin) {
        throw new Error(
            "Invalid username or password."
        );
    }

    if (!admin.is_active) {
        throw new Error(
            "Invalid username or password."
        );
    }

    const passwordValid =
        await verifyPassword(
            validated.password,
            admin.password_hash
        );

    if (!passwordValid) {
        throw new Error(
            "Invalid username or password."
        );
    }

    return {
        id: admin.id,
        username: admin.username,
        userType: "admin",
        isActive: Boolean(admin.is_active),
    };
}


module.exports = {
    validateAdminLogin,
    loginAdmin,
};