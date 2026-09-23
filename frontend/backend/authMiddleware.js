const {
    findSchoolById,
    findStudentById,
    findAdminById,
} = require("./userRepository");

const {
    getSession,
} = require("./session");

const SESSION_COOKIE_NAME = "session_token";


/**
 * Require a valid logged-in session.
 *
 * This middleware:
 * 1. Reads the session cookie.
 * 2. Validates the session.
 * 3. Checks that the account still exists.
 * 4. Checks that the account is still active.
 * 5. Attaches the authenticated user to req.user.
 */
async function requireAuth(req, res, next) {
    try {
        const sessionToken =
            req.cookies[SESSION_COOKIE_NAME];

        if (!sessionToken) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const session =
            await getSession(sessionToken);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Session expired or invalid.",
            });
        }

        let user = null;


        if (session.user_type === "admin") {
            user = await findAdminById(
                session.user_id
            );
        } else if (session.user_type === "school") {
            user = await findSchoolById(
                session.user_id
            );
        } else if (
            session.user_type === "student"
        ) {
            user = await findStudentById(
                session.user_id
            );
        } else {
            return res.status(401).json({
                success: false,
                message: "Invalid session type.",
            });
        }

        /*
         * Account no longer exists.
         */
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account not found.",
            });
        }

        /*
         * Account has been deactivated.
         */
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive.",
            });
        }

        req.user = {
            id: user.id,
            type: session.user_type,
        };

        return next();

    } catch (error) {
        console.error(
            "Authentication middleware error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Authentication check failed.",
        });
    }
}


/**
 * Require a logged-in school.
 */
function requireSchool(req, res, next) {
    if (
        !req.user ||
        req.user.type !== "school"
    ) {
        return res.status(403).json({
            success: false,
            message: "School access required.",
        });
    }

    return next();
}


/**
 * Require a logged-in student.
 */
function requireStudent(req, res, next) {
    if (
        !req.user ||
        req.user.type !== "student"
    ) {
        return res.status(403).json({
            success: false,
            message: "Student access required.",
        });
    }

    return next();
}

/**
 * Require a logged-in admin.
 */
function requireAdmin(req, res, next) {
    if (
        !req.user ||
        req.user.type !== "admin"
    ) {
        return res.status(403).json({
            success: false,
            message: "Admin access required.",
        });
    }

    return next();
}

module.exports = {
    requireAuth,
    requireAdmin,
    requireSchool,
    requireStudent,
};