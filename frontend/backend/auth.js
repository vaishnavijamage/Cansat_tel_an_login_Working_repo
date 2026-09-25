
const {
    hashPassword,
    verifyPassword,
} = require("./password");

const {
    createSatellite,
    deactivateSatellite,
} = require("./telemetryStore");

const {
    findSchoolByEmail,
    createSchool,
    findSchoolById,
    findStudentById,
    findStudentByUsername,
    createStudent,
    updateStudentSatelliteId,
    findStudentsBySchoolId,
    deactivateStudent,
    deleteStudent,
    updateSchoolPassword,
    updateStudentPassword,
} = require("./userRepository");

const {
    createPasswordResetToken,
    resetPassword,
} = require("./passwordReset");

const {
    deleteSessionsByUser,
} = require("./session");


const pool = require("./database");

/**
 * Validate and normalize school registration data.
 */
function validateSchoolRegistration({
    schoolName,
    email,
    phone,
    password,
}) {
    const cleanSchoolName =
        typeof schoolName === "string"
            ? schoolName.trim()
            : "";

    const cleanEmail =
        typeof email === "string"
            ? email.trim().toLowerCase()
            : "";

    const cleanPhone =
        typeof phone === "string"
            ? phone.trim()
            : "";

    if (
        !cleanSchoolName ||
        !cleanEmail ||
        !cleanPhone ||
        !password
    ) {
        throw new Error("All fields are required.");
    }

    if (
        cleanSchoolName.length < 2 ||
        cleanSchoolName.length > 150
    ) {
        throw new Error(
            "School name must be between 2 and 150 characters."
        );
    }

    if (/\s{2,}/.test(cleanSchoolName)) {
        throw new Error(
            "School name contains invalid spacing."
        );
    }

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
        throw new Error(
            "Please enter a valid email address."
        );
    }

    if (cleanEmail.length > 255) {
        throw new Error(
            "Email address is too long."
        );
    }

    const phonePattern =
        /^\+?[0-9]{10,15}$/;

    if (!phonePattern.test(cleanPhone)) {
        throw new Error(
            "Please enter a valid phone number."
        );
    }

    if (
        password.length < 8 ||
        password.length > 128
    ) {
        throw new Error(
            "Password must be between 8 and 128 characters."
        );
    }

    if (/\s/.test(password)) {
        throw new Error(
            "Password must not contain spaces."
        );
    }

    return {
        schoolName: cleanSchoolName,
        email: cleanEmail,
        phone: cleanPhone,
        password,
    };
}


/**
 * Register a new school.
 */
async function registerSchool(data) {
    const {
        schoolName,
        email,
        phone,
        password,
    } = validateSchoolRegistration(data);

    const existingSchool =
        await findSchoolByEmail(email);

    if (existingSchool) {
        throw new Error(
            "An account with this email already exists."
        );
    }

    const passwordHash =
        await hashPassword(password);

    const school = await createSchool({
        schoolName,
        email,
        phone,
        passwordHash,
    });

    if (!school) {
        throw new Error(
            "Unable to create school account."
        );
    }

    return {
        id: school.id,
        schoolName: school.school_name,
        email: school.email,
        phone: school.phone,
        isActive: school.is_active,
        createdAt: school.created_at,
    };
}


/**
 * Validate school login data.
 */
function validateSchoolLogin({
    email,
    password,
}) {
    const cleanEmail =
        typeof email === "string"
            ? email.trim().toLowerCase()
            : "";

    if (!cleanEmail || !password) {
        throw new Error(
            "Email and password are required."
        );
    }

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
        throw new Error(
            "Invalid email or password."
        );
    }

    if (password.length > 128) {
        throw new Error(
            "Invalid email or password."
        );
    }

    if (/\s/.test(password)) {
        throw new Error(
            "Invalid email or password."
        );
    }

    return {
        email: cleanEmail,
        password,
    };
}


/**
 * Authenticate a school.
 */
async function loginSchool(data) {
    const {
        email,
        password,
    } = validateSchoolLogin(data);

    const school =
        await findSchoolByEmail(email);

    if (!school) {
        throw new Error(
            "Invalid email or password."
        );
    }

    if (!school.is_active) {
        throw new Error(
            "This school account is inactive."
        );
    }

    const passwordIsValid =
        await verifyPassword(
            password,
            school.password_hash
        );

    if (!passwordIsValid) {
        throw new Error(
            "Invalid email or password."
        );
    }

    return {
        id: school.id,
        schoolName: school.school_name,
        email: school.email,
        phone: school.phone,
        isActive: school.is_active,
    };
}

/**
 * Change a school's password.
 */
async function changeSchoolPassword({
    schoolId,
    currentPassword,
    newPassword,
}) {
    if (!currentPassword) {
        throw new Error(
            "Current password is required."
        );
    }

    const cleanNewPassword =
        validateNewPassword(newPassword);

    const school =
        await findSchoolById(schoolId);

    if (!school || !school.is_active) {
        throw new Error(
            "School account is unavailable."
        );
    }

    const currentPasswordValid =
        await verifyPassword(
            currentPassword,
            school.password_hash
        );

    if (!currentPasswordValid) {
        throw new Error(
            "Current password is incorrect."
        );
    }

    const passwordHash =
        await hashPassword(cleanNewPassword);

    const updated =
        await updateSchoolPassword(
            schoolId,
            passwordHash
        );

    if (!updated) {
        throw new Error(
            "Unable to update password."
        );
    }

    await deleteSessionsByUser(
        schoolId,
        "school"
    );

    return true;
}

/**
 * Start school password recovery.
 */
async function requestSchoolPasswordReset(email) {
    const cleanEmail =
        typeof email === "string"
            ? email.trim().toLowerCase()
            : "";

    if (!cleanEmail) {
        throw new Error("Email is required.");
    }

    const school =
        await findSchoolByEmail(cleanEmail);

    /*
     * Do not reveal whether the email exists.
     */
    if (!school || !school.is_active) {
        return {
            success: true,
            message:
                "If the account exists, password recovery instructions will be sent.",
        };
    }

    const resetToken =
        await createPasswordResetToken({
            userType: "school",
            userId: school.id,
            expiresInMinutes: 15,
        });

    /*
     * TEMPORARY DEVELOPMENT RESULT.
     *
     * We will NOT return this token in production.
     * Later it will be sent through the verified
     * school email/OTP system.
     */
    return {
        success: true,
        message:
            "If the account exists, password recovery instructions will be sent.",
        resetToken,
    };
}

/**
 * Change a student's password.
 */
async function changeStudentPassword({
    studentId,
    currentPassword,
    newPassword,
}) {
    if (!currentPassword) {
        throw new Error(
            "Current password is required."
        );
    }

    const cleanNewPassword =
        validateNewPassword(newPassword);

    const student =
        await findStudentById(studentId);

    if (!student || !student.is_active) {
        throw new Error(
            "Student account is unavailable."
        );
    }

    const currentPasswordValid =
        await verifyPassword(
            currentPassword,
            student.password_hash
        );

    if (!currentPasswordValid) {
        throw new Error(
            "Current password is incorrect."
        );
    }

    const passwordHash =
        await hashPassword(cleanNewPassword);

    const updated =
        await updateStudentPassword(
            studentId,
            passwordHash
        );

    if (!updated) {
        throw new Error(
            "Unable to update password."
        );
    }

    await deleteSessionsByUser(
        studentId,
        "student"
    );

    return true;
}

/**
 * Reset a user's password using a valid reset token.
 */
async function resetUserPassword({
    token,
    newPassword,
}) {
    const result = await resetPassword({
        token,
        newPassword,
    });

    /*
     * Revoke all existing sessions after
     * a successful password reset.
     */
    await deleteSessionsByUser(
        result.userId,
        result.userType
    );

    return {
        success: true,
        message:
            "Password reset successfully. Please log in again.",
    };
}

/**
 * Validate student login data.
 */
function validateStudentLogin({
    username,
    password,
}) {
    const cleanUsername =
        typeof username === "string"
            ? username.trim().toLowerCase()
            : "";

    if (!cleanUsername || !password) {
        throw new Error(
            "Username and password are required."
        );
    }

    const usernamePattern =
        /^[a-z0-9_.]{4,50}$/;

    if (!usernamePattern.test(cleanUsername)) {
        throw new Error(
            "Invalid username or password."
        );
    }

    if (password.length > 128) {
        throw new Error(
            "Invalid username or password."
        );
    }

    if (/\s/.test(password)) {
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
 * Authenticate a student.
 */
async function loginStudent(data) {
    const {
        username,
        password,
    } = validateStudentLogin(data);

    const student =
        await findStudentByUsername(username);

    if (!student) {
        throw new Error(
            "Invalid username or password."
        );
    }

    if (!student.is_active) {
        throw new Error(
            "This student account is inactive."
        );
    }

    const passwordIsValid =
        await verifyPassword(
            password,
            student.password_hash
        );

    if (!passwordIsValid) {
        throw new Error(
            "Invalid username or password."
        );
    }

    return {
        id: student.id,
        schoolId: student.school_id,
        studentName: student.student_name,
        username: student.username,
        satelliteId: student.satellite_id,
        isActive: student.is_active,
    };
}

/**
 * Validate a new password.
 */
function validateNewPassword(password) {
    if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
    ) {
        throw new Error(
            "Password must be between 8 and 128 characters."
        );
    }

    if (/\s/.test(password)) {
        throw new Error(
            "Password must not contain spaces."
        );
    }

    return password;
}

/**
 * Validate student creation data.
 */
function validateStudentCreation({
    studentName,
    username,
    password,

}) {
    const cleanStudentName =
        typeof studentName === "string"
            ? studentName.trim()
            : "";

    const cleanUsername =
        typeof username === "string"
            ? username.trim().toLowerCase()
            : "";

    if (
        !cleanStudentName ||
        !cleanUsername ||
        !password
    ) {
        throw new Error(
            "All student fields are required."
        );
    }

    if (
        cleanStudentName.length < 2 ||
        cleanStudentName.length > 150
    ) {
        throw new Error(
            "Student name must be between 2 and 150 characters."
        );
    }

    if (/\s{2,}/.test(cleanStudentName)) {
        throw new Error(
            "Student name contains invalid spacing."
        );
    }



    /*
     * Username rules:
     * 4-50 characters
     * lowercase letters
     * numbers
     * underscore
     * dot
     * no spaces
     */
    const usernamePattern =
        /^[a-z0-9_.]{4,50}$/;

    if (!usernamePattern.test(cleanUsername)) {
        throw new Error(
            "Username must be 4-50 characters and may contain only letters, numbers, underscores and dots."
        );
    }

    if (
        password.length < 8 ||
        password.length > 128
    ) {
        throw new Error(
            "Password must be between 8 and 128 characters."
        );
    }

    if (/\s/.test(password)) {
        throw new Error(
            "Password must not contain spaces."
        );
    }

    return {
        studentName: cleanStudentName,
        username: cleanUsername,
        password,
    };
}



/**
 * Create a student account for a school.
 */
async function createStudentAccount({
    schoolId,
    studentName,
    username,
    password,
}) {
    if (
        !Number.isInteger(schoolId) ||
        schoolId <= 0
    ) {
        throw new Error(
            "Invalid school account."
        );
    }

    const validated =
        validateStudentCreation({
            studentName,
            username,
            password,
        });

    const existingStudent =
        await findStudentByUsername(
            validated.username
        );

    if (existingStudent) {
        throw new Error(
            "This username is already in use."
        );
    }

    const passwordHash =
        await hashPassword(
            validated.password
        );

    const student =
        await createStudent({
            schoolId,
            studentName:
                validated.studentName,
            username:
                validated.username,
            passwordHash,
            satelliteId: null,
        });

    if (!student) {
        throw new Error(
            "Unable to create student account."
        );
    }
    const satelliteId =
        `SAT-${String(student.id).padStart(4, "0")}`;

    const updated =
        await updateStudentSatelliteId(
            student.id,
            schoolId,
            satelliteId
        );

    if (!updated) {
        await deleteStudent(student.id, schoolId);

        throw new Error(
            "Unable to assign satellite ID."
        );
    }

    try {
        await createSatellite(satelliteId);
    } catch (error) {
        await deleteStudent(student.id, schoolId);

        throw new Error(
            "Unable to register satellite."
        );
    }

    return {
        id: student.id,
        schoolId: student.school_id,
        studentName: student.student_name,
        username: student.username,
        satelliteId,
        isActive: student.is_active,
        createdAt: student.created_at,
    };
}

/**
 * Get all students belonging to a school.
 */
async function getSchoolStudents(schoolId) {
    if (
        !Number.isInteger(schoolId) ||
        schoolId <= 0
    ) {
        throw new Error("Invalid school account.");
    }

    const students =
        await findStudentsBySchoolId(schoolId);

    return students.map((student) => ({
        id: student.id,
        schoolId: student.school_id,
        studentName: student.student_name,
        username: student.username,
        satelliteId: student.satellite_id,
        isActive: student.is_active,
        createdAt: student.created_at,
    }));
}

/**
 * Deactivate a student belonging to a school.
 */
async function deactivateSchoolStudent(studentId, schoolId) {
    const parsedStudentId = Number(studentId);

    if (
        !Number.isInteger(parsedStudentId) ||
        parsedStudentId <= 0
    ) {
        throw new Error("Invalid student ID.");
    }

    if (
        !Number.isInteger(schoolId) ||
        schoolId <= 0
    ) {
        throw new Error("Invalid school account.");
    }

    const deactivated =
        await deactivateStudent(
            parsedStudentId,
            schoolId
        );

    if (!deactivated) {
        throw new Error(
            "Student not found or does not belong to this school."
        );
    }

    return true;
}

/**
 * Delete a student belonging to a school.
 */
async function deleteSchoolStudent(studentId, schoolId) {
    const parsedStudentId = Number(studentId);

    if (
        !Number.isInteger(parsedStudentId) ||
        parsedStudentId <= 0
    ) {
        throw new Error("Invalid student ID.");
    }

    if (
        !Number.isInteger(schoolId) ||
        schoolId <= 0
    ) {
        throw new Error("Invalid school account.");
    }

    const student =
        await findStudentById(parsedStudentId);

    if (
        !student ||
        student.school_id !== schoolId
    ) {
        throw new Error(
            "Student not found or does not belong to this school."
        );
    }

    const satelliteId =
        student.satellite_id;

    const deleted =
        await deleteStudent(
            parsedStudentId,
            schoolId
        );

    if (!deleted) {
        throw new Error(
            "Unable to delete student."
        );
    }

    if (satelliteId) {
        await deactivateSatellite(
            satelliteId
        );
    }

    return true;
}

async function activateSchoolStudent(
    studentId,
    schoolId
) {
    const [result] = await pool.execute(
        `
        UPDATE students
        SET is_active = TRUE
        WHERE id = ?
          AND school_id = ?
        `,
        [studentId, schoolId]
    );

    if (result.affectedRows === 0) {
        throw new Error(
            "Student not found or does not belong to this school."
        );
    }

    return true;
}

module.exports = {
    registerSchool,
    loginSchool,
    loginStudent,
    createStudentAccount,

    getSchoolStudents,
    deactivateSchoolStudent,
    deleteSchoolStudent,

    changeSchoolPassword,
    changeStudentPassword,

    requestSchoolPasswordReset,
    resetUserPassword,

    activateSchoolStudent,
};