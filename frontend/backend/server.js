const telemetryReadRoutes =
    require("./telemetryReadRoutes");

const telemetryRoutes = require("./telemetryRoutes");

const {
    requireAuth,
    requireAdmin,
    requireSchool,
    requireStudent,
} = require("./authMiddleware");



const {
    loginAdmin,
} = require("./adminAuth");

const {
    findStudentById,
    findAllSchools,
    deactivateSchool,
    activateSchool,
    deleteSchool,
    findAllStudents,
    deactivateStudentByAdmin,
    activateStudentByAdmin,
    deleteStudentByAdmin,
} = require("./userRepository");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const {
    registerSchool,
    loginSchool,
    loginStudent,
    createStudentAccount,
    getSchoolStudents,
    deactivateSchoolStudent,
    deleteSchoolStudent,
    activateSchoolStudent,
    changeSchoolPassword,
    changeStudentPassword,
    requestSchoolPasswordReset,
    resetUserPassword,
} = require("./auth");

const {
    createSession,
    deleteSession,
} = require("./session");


const app = express();

const PORT = Number(process.env.PORT) || 5000;

const FRONTEND_URL =
    process.env.FRONTEND_URL || "http://localhost:5173";

const SESSION_COOKIE_NAME = "session_token";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;


/*
 * CORS
 */
app.use(
    cors({
        origin: FRONTEND_URL,
        credentials: true,
        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],
    })
);


app.use(express.json({ limit: "10kb" }));

/*
 * Cookie parser
 */
app.use(cookieParser());

/*
 * Telemetry ingest API
 */
app.use(
    "/api/v1/telemetry",
    telemetryRoutes
);


/*
 * Telemetry read APIs
 */
app.use(
    "/api/v1/telemetry",
    telemetryReadRoutes
);


/*
 * Health check
 */
app.get("/api/health", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Backend is running.",
    });
});


/*
 * School registration
 */
app.post("/api/auth/register", async (req, res) => {
    try {
        const school = await registerSchool(req.body);

        return res.status(201).json({
            success: true,
            message: "School account created successfully.",
            school: {
                id: school.id,
                schoolName: school.school_name,
                email: school.email,
                phone: school.phone,
            },
        });
    } catch (error) {
        console.error(
            "School registration error:",
            error.message
        );

        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});


/*
 * School login
 */
app.post("/api/auth/login", async (req, res) => {
    try {
        const school = await loginSchool(req.body);

        /*
         * Create a secure server-side session.
         */
        const session = await createSession({
            userId: school.id,
            userType: "school",
        });


        /*
         * Send the session token as an HTTP-only cookie.
         *
         * HTTP-only:
         * JavaScript cannot read the cookie.
         *
         * Secure:
         * HTTPS is required in production.
         *
         * SameSite:
         * Helps protect against CSRF.
         */
        res.cookie(
            SESSION_COOKIE_NAME,
            session.sessionToken,
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: SESSION_DURATION_MS,
                path: "/",
            }
        );


        /*
         * Never send password_hash to the frontend.
         */
        return res.status(200).json({
            success: true,
            message: "School login successful.",
            school: {
                id: school.id,
                schoolName: school.school_name,
                email: school.email,
                phone: school.phone,
            },
        });

    } catch (error) {
        console.error(
            "School login error:",
            error.message
        );

        return res.status(401).json({
            success: false,
            message: "Invalid email or password.",
        });
    }
});

/* admin login */

app.post("/api/auth/admin/login", async (req, res) => {
    try {
        const {
            username,
            password,
        } = req.body;

        const admin = await loginAdmin({
            username,
            password,
        });

        const session = await createSession({
            userId: admin.id,
            userType: "admin",
        });

        res.cookie(
            "session_token",
            session.sessionToken,
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite:
                    process.env.NODE_ENV === "production"
                        ? "none"
                        : "lax",
                maxAge:
                    session.expiresAt.getTime() -
                    Date.now(),
                path: "/",
            }
        );

        return res.status(200).json({
            success: true,
            message: "Admin login successful.",
            admin: {
                id: admin.id,
                username: admin.username,
                userType: admin.userType,
            },
        });

    } catch (error) {

        console.error(
            "Admin login error:",
            error
        );

        return res.status(401).json({
            success: false,
            message: "Invalid username or password.",
        });
    }
});

/*
 * Get currently logged-in admin
 */
app.get(
    "/api/auth/admin/me",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        return res.status(200).json({
            success: true,
            admin: {
                id: req.user.id,
                userType: req.user.type,
            },
        });
    }
);

/*
 * Admin: Get all schools
 */
app.get(
    "/api/admin/schools",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const schools = await findAllSchools();

            return res.status(200).json({
                success: true,
                schools,
            });
        } catch (error) {
            console.error(
                "Admin get schools error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to retrieve schools.",
            });
        }
    }
);

/*
 * Admin: Get all students
 */
app.get(
    "/api/admin/students",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const students = await findAllStudents();

            return res.status(200).json({
                success: true,
                students,
            });
        } catch (error) {
            console.error(
                "Admin get students error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to retrieve students.",
            });
        }
    }
);

/*
 * Admin: Deactivate a school
 */
app.patch(
    "/api/admin/schools/:schoolId/deactivate",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const schoolId = Number(req.params.schoolId);

            if (!Number.isInteger(schoolId) || schoolId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid school ID.",
                });
            }

            const deactivated =
                await deactivateSchool(schoolId);

            if (!deactivated) {
                return res.status(404).json({
                    success: false,
                    message: "School not found.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "School deactivated successfully.",
            });

        } catch (error) {
            console.error(
                "Admin deactivate school error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to deactivate school.",
            });
        }
    }
);

/*
 * Admin: Activate a school
 */
app.patch(
    "/api/admin/schools/:schoolId/activate",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const schoolId = Number(req.params.schoolId);

            if (!Number.isInteger(schoolId) || schoolId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid school ID.",
                });
            }

            const activated =
                await activateSchool(schoolId);

            if (!activated) {
                return res.status(404).json({
                    success: false,
                    message: "School not found.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "School activated successfully.",
            });

        } catch (error) {
            console.error(
                "Admin activate school error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to activate school.",
            });
        }
    }
);

/*
 * Admin: Delete a school
 */
app.delete(
    "/api/admin/schools/:schoolId",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const schoolId = Number(req.params.schoolId);

            if (!Number.isInteger(schoolId) || schoolId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid school ID.",
                });
            }

            const deleted =
                await deleteSchool(schoolId);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: "School not found.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "School deleted successfully.",
            });

        } catch (error) {
            console.error(
                "Admin delete school error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to delete school.",
            });
        }
    }
);

/*
 * Admin: Deactivate a student
 */
app.patch(
    "/api/admin/students/:studentId/deactivate",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const studentId = Number(req.params.studentId);

            if (!Number.isInteger(studentId) || studentId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid student ID.",
                });
            }

            const deactivated =
                await deactivateStudentByAdmin(studentId);

            if (!deactivated) {
                return res.status(404).json({
                    success: false,
                    message: "Student not found.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Student deactivated successfully.",
            });

        } catch (error) {
            console.error(
                "Admin deactivate student error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to deactivate student.",
            });
        }
    }
);

/*
 * Admin: Activate a student
 */
app.patch(
    "/api/admin/students/:studentId/activate",
    requireAuth,
    requireAdmin,
    async (req, res) => {
        try {
            const studentId = Number(req.params.studentId);

            if (!Number.isInteger(studentId) || studentId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid student ID.",
                });
            }

            const activated =
                await activateStudentByAdmin(studentId);

            if (!activated) {
                return res.status(404).json({
                    success: false,
                    message: "Student not found.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Student activated successfully.",
            });

        } catch (error) {
            console.error(
                "Admin activate student error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to activate student.",
            });
        }
    }
);

/*
 * Student login
 */
app.post("/api/auth/student-login", async (req, res) => {
    try {
        const student =
            await loginStudent(req.body);

        const session = await createSession({
            userId: student.id,
            userType: "student",
        });

        res.cookie(
            SESSION_COOKIE_NAME,
            session.sessionToken,
            {
                httpOnly: true,
                secure:
                    process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: SESSION_DURATION_MS,
                path: "/",
            }
        );

        return res.status(200).json({
            success: true,
            message: "Student login successful.",
            student,
        });
    } catch (error) {
        console.error(
            "Student login error:",
            error.message
        );

        return res.status(401).json({
            success: false,
            message: error.message,
        });
    }
});

/*
 * Request school password reset
 */
app.post(
    "/api/auth/forgot-password",
    async (req, res) => {
        try {
            const result =
                await requestSchoolPasswordReset(
                    req.body.email
                );

            return res.status(200).json(result);

        } catch (error) {
            console.error(
                "Password reset request error:",
                error.message
            );

            return res.status(400).json({
                success: false,
                message:
                    "Unable to process password recovery request.",
            });
        }
    }
);

/*
 * School logout
 */
app.post("/api/auth/logout", async (req, res) => {
    try {
        const sessionToken =
            req.cookies[SESSION_COOKIE_NAME];

        if (sessionToken) {
            await deleteSession(sessionToken);
        }

        res.clearCookie(
            SESSION_COOKIE_NAME,
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
            }
        );

        return res.status(200).json({
            success: true,
            message: "Logged out successfully.",
        });

    } catch (error) {
        console.error(
            "Logout error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to logout.",
        });
    }
});


app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.status(200).json({
        success: true,
        user: req.user,
    });
});

/*
 * Add a student to the logged-in school.
 */
app.post(
    "/api/students",
    requireAuth,
    requireSchool,
    async (req, res) => {
        try {
            const student =
                await createStudentAccount({
                    schoolId: req.user.id,
                    studentName: req.body.studentName,
                    username: req.body.username,
                    password: req.body.password,
                    satelliteId: req.body.satelliteId,

                });

            return res.status(201).json({
                success: true,
                message:
                    "Student account created successfully.",
                student,
            });
        } catch (error) {
            console.error(
                "Student creation error:",
                error.message
            );

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
);

/*
 * Get all students belonging to the
 * currently logged-in school.
 */
app.get(
    "/api/students",
    requireAuth,
    requireSchool,
    async (req, res) => {
        try {
            const students =
                await getSchoolStudents(
                    req.user.id
                );

            return res.status(200).json({
                success: true,
                students,
            });
        } catch (error) {
            console.error(
                "Get students error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to retrieve students.",
            });
        }
    }
);

/*
 * Deactivate a student belonging to the
 * currently logged-in school.
 */
app.patch(
    "/api/students/:id/deactivate",
    requireAuth,
    requireSchool,
    async (req, res) => {
        try {
            await deactivateSchoolStudent(
                req.params.id,
                req.user.id
            );

            return res.status(200).json({
                success: true,
                message:
                    "Student account deactivated successfully.",
            });
        } catch (error) {
            console.error(
                "Student deactivation error:",
                error.message
            );

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
);

/*
 * Activate a student belonging to the
 * currently logged-in school.
 */
app.patch(
    "/api/students/:id/activate",
    requireAuth,
    requireSchool,
    async (req, res) => {
        try {
            await activateSchoolStudent(
                req.params.id,
                req.user.id
            );

            return res.status(200).json({
                success: true,
                message:
                    "Student account activated successfully.",
            });
        } catch (error) {
            console.error(
                "Student activation error:",
                error.message
            );

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
);

/*
 * Delete a student belonging to the
 * currently logged-in school.
 */
app.delete(
    "/api/students/:id",
    requireAuth,
    requireSchool,
    async (req, res) => {
        try {
            await deleteSchoolStudent(
                req.params.id,
                req.user.id
            );

            return res.status(200).json({
                success: true,
                message:
                    "Student account deleted successfully.",
            });
        } catch (error) {
            console.error(
                "Student deletion error:",
                error.message
            );

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
);

/*
 * Get the currently logged-in student's account.
 */
app.get(
    "/api/auth/student/me",
    requireAuth,
    requireStudent,
    async (req, res) => {
        try {
            const student =
                await findStudentById(req.user.id);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: "Student account not found.",
                });
            }

            return res.status(200).json({
                success: true,
                student: {
                    id: student.id,
                    schoolId: student.school_id,
                    studentName: student.student_name,
                    username: student.username,
                    satelliteId: student.satellite_id,
                    isActive: student.is_active,
                    createdAt: student.created_at,
                },
            });
        } catch (error) {
            console.error(
                "Student profile error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve student account.",
            });
        }
    }
);

/*
 * Change school password
 */
app.patch(
    "/api/auth/school/password",
    requireAuth,
    requireSchool,
    async (req, res) => {
        try {
            await changeSchoolPassword({
                schoolId: req.user.id,
                currentPassword: req.body.currentPassword,
                newPassword: req.body.newPassword,
            });

            return res.status(200).json({
                success: true,
                message:
                    "Password changed successfully. Please log in again.",
            });
        } catch (error) {
            console.error(
                "School password change error:",
                error.message
            );

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
);

/*
 * Change student password
 */
app.patch(
    "/api/auth/student/password",
    requireAuth,
    requireStudent,
    async (req, res) => {
        try {
            await changeStudentPassword({
                studentId: req.user.id,
                currentPassword: req.body.currentPassword,
                newPassword: req.body.newPassword,
            });

            return res.status(200).json({
                success: true,
                message:
                    "Password changed successfully. Please log in again.",
            });
        } catch (error) {
            console.error(
                "Student password change error:",
                error.message
            );

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
);

/*
 * Reset password using a valid reset token.
 */
app.post(
    "/api/auth/reset-password",
    async (req, res) => {
        try {
            const {
                token,
                newPassword,
            } = req.body;

            const result =
                await resetUserPassword({
                    token,
                    newPassword,
                });

            return res.status(200).json(result);

        } catch (error) {
            console.error(
                "Password reset error:",
                error.message
            );

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
);

/*
 * Unknown route
 */
app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "Route not found.",
    });
});


/*
 * Global error handler
 */
app.use((error, req, res, next) => {
    console.error("Server error:", error);

    return res.status(500).json({
        success: false,
        message: "Internal server error.",
    });
});


/*
 * Start server
 */
app.listen(PORT, () => {
    console.log(
        `Backend server running on port ${PORT}`
    );
});