const pool = require("./database");

/**
 * Find a school by email.
 */
async function findSchoolByEmail(email) {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            school_name,
            email,
            phone,
            password_hash,
            is_active,
            created_at,
            updated_at
        FROM schools
        WHERE email = ?
        LIMIT 1
        `,
        [email]
    );

    return rows[0] || null;
}

/**
 * Find a school by ID.
 */
async function findSchoolById(id) {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            school_name,
            email,
            phone,
            password_hash,
            is_active,
            created_at,
            updated_at
        FROM schools
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    );

    return rows[0] || null;
}

/**
 * Create a new school.
 *
 * IMPORTANT:
 * passwordHash must already be generated using Argon2id.
 */
async function createSchool({
    schoolName,
    email,
    phone,
    passwordHash,
}) {
    const [result] = await pool.execute(
        `
        INSERT INTO schools (
            school_name,
            email,
            phone,
            password_hash
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            schoolName,
            email,
            phone,
            passwordHash,
        ]
    );

    return findSchoolById(result.insertId);
}

/**
 * Find a student by username.
 */
async function findStudentByUsername(username) {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            school_id,
            student_name,
            username,
            password_hash,
            satellite_id,
            is_active,
            created_at,
            updated_at
        FROM students
        WHERE username = ?
        LIMIT 1
        `,
        [username]
    );

    return rows[0] || null;
}

/**
 * Find a student by ID.
 */
async function findStudentById(id) {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            school_id,
            student_name,
            username,
            password_hash,
            satellite_id,
            is_active,
            created_at,
            updated_at
        FROM students
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    );

    return rows[0] || null;
}

/**
 * Find an admin by ID.
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
 * Get all students belonging to one school.
 */
async function findStudentsBySchoolId(schoolId) {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            school_id,
            student_name,
            username,
            satellite_id,
            is_active,
            created_at,
            updated_at
        FROM students
        WHERE school_id = ?
        ORDER BY student_name ASC
        `,
        [schoolId]
    );

    return rows;
}

/**
 * Create a student.
 *
 * IMPORTANT:
 * passwordHash must already be generated using Argon2id.
 */
async function createStudent({
    schoolId,
    studentName,
    username,
    passwordHash,
    satelliteId,
}) {
    const [result] = await pool.execute(
        `
        INSERT INTO students (
            school_id,
            student_name,
            username,
            password_hash,
            satellite_id
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
            schoolId,
            studentName,
            username,
            passwordHash,
            satelliteId,
        ]
    );

    return findStudentById(result.insertId);
}

/**
 * Disable a student account.
 */
async function deactivateStudent(studentId, schoolId) {
    const [result] = await pool.execute(
        `
        UPDATE students
        SET is_active = FALSE
        WHERE id = ?
          AND school_id = ?
        `,
        [studentId, schoolId]
    );

    return result.affectedRows > 0;
}

/**
 * Delete a student account.
 */
async function deleteStudent(studentId, schoolId) {
    const [result] = await pool.execute(
        `
        DELETE FROM students
        WHERE id = ?
          AND school_id = ?
        `,
        [studentId, schoolId]
    );

    return result.affectedRows > 0;
}


async function updateStudentSatelliteId(
    studentId,
    schoolId,
    satelliteId
) {
    const [result] = await pool.execute(
        `
        UPDATE students
        SET satellite_id = ?
        WHERE id = ?
          AND school_id = ?
        `,
        [satelliteId, studentId, schoolId]
    );

    return result.affectedRows > 0;
}

/**
 * Update a school's password hash.
 */
async function updateSchoolPassword(schoolId, passwordHash) {
    const [result] = await pool.execute(
        `
        UPDATE schools
        SET password_hash = ?
        WHERE id = ?
        `,
        [passwordHash, schoolId]
    );

    return result.affectedRows > 0;
}


/**
 * Update a student's password hash.
 */
async function updateStudentPassword(
    studentId,
    passwordHash
) {
    const [result] = await pool.execute(
        `
        UPDATE students
        SET password_hash = ?
        WHERE id = ?
        `,
        [passwordHash, studentId]
    );

    return result.affectedRows > 0;
}

/**
 * Get all schools.
 */
async function findAllSchools() {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            school_name,
            email,
            phone,
            is_active,
            created_at,
            updated_at
        FROM schools
        ORDER BY school_name ASC
        `
    );

    return rows;
}


/**
 * Deactivate a school account.
 */
async function deactivateSchool(schoolId) {
    const [result] = await pool.execute(
        `
        UPDATE schools
        SET is_active = FALSE
        WHERE id = ?
        `,
        [schoolId]
    );

    return result.affectedRows > 0;
}


/**
 * Activate a school account.
 */
async function activateSchool(schoolId) {
    const [result] = await pool.execute(
        `
        UPDATE schools
        SET is_active = TRUE
        WHERE id = ?
        `,
        [schoolId]
    );

    return result.affectedRows > 0;
}


/**
 * Delete a school account.
 *
 * Related students and school MFA records are
 * automatically removed by the database foreign keys.
 */
async function deleteSchool(schoolId) {
    const [result] = await pool.execute(
        `
        DELETE FROM schools
        WHERE id = ?
        `,
        [schoolId]
    );

    return result.affectedRows > 0;
}


/**
 * Get all students.
 */
async function findAllStudents() {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            school_id,
            student_name,
            username,
            satellite_id,
            is_active,
            created_at,
            updated_at
        FROM students
        ORDER BY student_name ASC
        `
    );

    return rows;
}


/**
 * Deactivate a student account.
 */
async function deactivateStudentByAdmin(studentId) {
    const [result] = await pool.execute(
        `
        UPDATE students
        SET is_active = FALSE
        WHERE id = ?
        `,
        [studentId]
    );

    return result.affectedRows > 0;
}


/**
 * Activate a student account.
 */
async function activateStudentByAdmin(studentId) {
    const [result] = await pool.execute(
        `
        UPDATE students
        SET is_active = TRUE
        WHERE id = ?
        `,
        [studentId]
    );

    return result.affectedRows > 0;
}


/**
 * Delete a student account as admin.
 */
async function deleteStudentByAdmin(studentId) {
    const [result] = await pool.execute(
        `
        DELETE FROM students
        WHERE id = ?
        `,
        [studentId]
    );

    return result.affectedRows > 0;
}

/**
 * Get active student and school information
 * mapped to satellites.
 *
 * One query is used for the complete mapping.
 */
async function findActiveSatelliteOwners() {
    const [rows] = await pool.execute(
        `
        SELECT
            st.satellite_id,
            st.id AS student_id,
            st.student_name,
            sc.id AS school_id,
            sc.school_name
        FROM students st
        INNER JOIN schools sc
            ON sc.id = st.school_id
        WHERE st.is_active = TRUE
          AND sc.is_active = TRUE
          AND st.satellite_id IS NOT NULL
          AND st.satellite_id <> ''
        `
    );

    return rows;
}

/**
 * Find the active owner of a specific satellite.
 */
async function findActiveSatelliteOwnerBySatelliteId(satelliteId) {
    const [rows] = await pool.execute(
        `
        SELECT
            st.satellite_id,
            st.id AS student_id,
            st.student_name,
            st.school_id,
            sc.school_name
        FROM students st
        INNER JOIN schools sc
            ON sc.id = st.school_id
        WHERE st.satellite_id = ?
          AND st.is_active = TRUE
          AND sc.is_active = TRUE
        LIMIT 1
        `,
        [satelliteId]
    );

    return rows[0] || null;
}

module.exports = {
    findSchoolByEmail,
    findSchoolById,
    findAdminById,
    createSchool,

    findStudentByUsername,
    findStudentById,
    findStudentsBySchoolId,
    createStudent,
    deactivateStudent,
    deleteStudent,

    updateSchoolPassword,
    updateStudentPassword,

    findAllSchools,
    deactivateSchool,
    activateSchool,
    deleteSchool,

    findAllStudents,
    deactivateStudentByAdmin,
    activateStudentByAdmin,
    deleteStudentByAdmin,

    findActiveSatelliteOwners,
    findActiveSatelliteOwnerBySatelliteId,
    updateStudentSatelliteId,
};

