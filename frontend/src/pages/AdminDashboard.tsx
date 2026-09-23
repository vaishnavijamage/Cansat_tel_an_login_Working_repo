import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000";

type School = {
    id: number;
    school_name: string;
    email: string;
    phone: string;
    is_active: number | boolean;
    created_at: string;
    updated_at: string;
};

type Student = {
    id: number;
    school_id: number;
    student_name: string;
    username: string;
    satellite_id: string | null;
    is_active: number | boolean;
    created_at: string;
    updated_at: string;
};

type Admin = {
    id: number;
    username?: string;
    userType: string;
};

type Section = "overview" | "schools" | "students";

function isActive(value: number | boolean) {
    return value === 1 || value === true;
}

export default function AdminDashboard() {
    const navigate = useNavigate();

    const [activeSection, setActiveSection] =
        useState<Section>("overview");

    const [admin, setAdmin] = useState<Admin | null>(null);

    const [schools, setSchools] = useState<School[]>([]);
    const [students, setStudents] = useState<Student[]>([]);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] =
        useState<string | null>(null);

    const [error, setError] = useState("");

    const [schoolSearch, setSchoolSearch] =
        useState("");

    const [studentSearch, setStudentSearch] =
        useState("");

    const [studentSchoolFilter, setStudentSchoolFilter] =
        useState("all");

    const [deleteTarget, setDeleteTarget] = useState<{
        type: "school" | "student";
        id: number;
        name: string;
    } | null>(null);

    /*
     * Load admin, schools and students.
     */
    useEffect(() => {
        loadDashboard();
    }, []);

    async function loadDashboard() {
        try {
            setLoading(true);
            setError("");

            const [
                adminResponse,
                schoolsResponse,
                studentsResponse,
            ] = await Promise.all([
                fetch(
                    `${API_BASE_URL}/api/auth/admin/me`,
                    {
                        credentials: "include",
                    }
                ),

                fetch(
                    `${API_BASE_URL}/api/admin/schools`,
                    {
                        credentials: "include",
                    }
                ),

                fetch(
                    `${API_BASE_URL}/api/admin/students`,
                    {
                        credentials: "include",
                    }
                ),
            ]);

            if (adminResponse.status === 401) {
                navigate("/admin-login", {
                    replace: true,
                });
                return;
            }

            if (!adminResponse.ok) {
                throw new Error(
                    "Unable to verify admin session."
                );
            }

            if (!schoolsResponse.ok) {
                throw new Error(
                    "Unable to load schools."
                );
            }

            if (!studentsResponse.ok) {
                throw new Error(
                    "Unable to load students."
                );
            }

            const adminData =
                await adminResponse.json();

            const schoolsData =
                await schoolsResponse.json();

            const studentsData =
                await studentsResponse.json();

            setAdmin(adminData.admin);
            setSchools(schoolsData.schools || []);
            setStudents(studentsData.students || []);
        } catch (err) {
            console.error(
                "Admin dashboard error:",
                err
            );

            setError(
                "Unable to load dashboard data."
            );
        } finally {
            setLoading(false);
        }
    }

    /*
     * Logout.
     */
    async function handleLogout() {
        try {
            setActionLoading("logout");

            await fetch(
                `${API_BASE_URL}/api/auth/logout`,
                {
                    method: "POST",
                    credentials: "include",
                }
            );
        } catch (err) {
            console.error(
                "Logout error:",
                err
            );
        } finally {
            navigate("/admin-login", {
                replace: true,
            });
        }
    }

    /*
     * Activate/deactivate school.
     */
    async function toggleSchool(
        school: School
    ) {
        const active = isActive(
            school.is_active
        );

        const action = active
            ? "deactivate"
            : "activate";

        const key = `school-${school.id}-${action}`;

        try {
            setActionLoading(key);
            setError("");

            const response = await fetch(
                `${API_BASE_URL}/api/admin/schools/${school.id}/${action}`,
                {
                    method: "PATCH",
                    credentials: "include",
                }
            );

            if (response.status === 401) {
                navigate("/admin-login", {
                    replace: true,
                });
                return;
            }

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Unable to update school."
                );
            }

            setSchools((current) =>
                current.map((item) =>
                    item.id === school.id
                        ? {
                            ...item,
                            is_active: active
                                ? 0
                                : 1,
                        }
                        : item
                )
            );
        } catch (err) {
            console.error(
                "School status error:",
                err
            );

            setError(
                "Unable to update school status."
            );
        } finally {
            setActionLoading(null);
        }
    }

    /*
     * Activate/deactivate student.
     */
    async function toggleStudent(
        student: Student
    ) {
        const active = isActive(
            student.is_active
        );

        const action = active
            ? "deactivate"
            : "activate";

        const key = `student-${student.id}-${action}`;

        try {
            setActionLoading(key);
            setError("");

            const response = await fetch(
                `${API_BASE_URL}/api/admin/students/${student.id}/${action}`,
                {
                    method: "PATCH",
                    credentials: "include",
                }
            );

            if (response.status === 401) {
                navigate("/admin-login", {
                    replace: true,
                });
                return;
            }

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Unable to update student."
                );
            }

            setStudents((current) =>
                current.map((item) =>
                    item.id === student.id
                        ? {
                            ...item,
                            is_active: active
                                ? 0
                                : 1,
                        }
                        : item
                )
            );
        } catch (err) {
            console.error(
                "Student status error:",
                err
            );

            setError(
                "Unable to update student status."
            );
        } finally {
            setActionLoading(null);
        }
    }

    /*
     * Delete school.
     */
    async function deleteSchool(
        schoolId: number
    ) {
        try {
            setActionLoading(
                `delete-school-${schoolId}`
            );
            setError("");

            const response = await fetch(
                `${API_BASE_URL}/api/admin/schools/${schoolId}`,
                {
                    method: "DELETE",
                    credentials: "include",
                }
            );

            if (response.status === 401) {
                navigate("/admin-login", {
                    replace: true,
                });
                return;
            }

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Unable to delete school."
                );
            }

            setSchools((current) =>
                current.filter(
                    (school) =>
                        school.id !== schoolId
                )
            );

            /*
             * The database foreign key removes
             * related students automatically.
             *
             * Remove them from the frontend too.
             */
            setStudents((current) =>
                current.filter(
                    (student) =>
                        student.school_id !==
                        schoolId
                )
            );
        } catch (err) {
            console.error(
                "Delete school error:",
                err
            );

            setError(
                "Unable to delete school."
            );
        } finally {
            setActionLoading(null);
            setDeleteTarget(null);
        }
    }

    /*
     * Delete student.
     */
    async function deleteStudent(
        studentId: number
    ) {
        try {
            setActionLoading(
                `delete-student-${studentId}`
            );
            setError("");

            const response = await fetch(
                `${API_BASE_URL}/api/admin/students/${studentId}`,
                {
                    method: "DELETE",
                    credentials: "include",
                }
            );

            if (response.status === 401) {
                navigate("/admin-login", {
                    replace: true,
                });
                return;
            }

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Unable to delete student."
                );
            }

            setStudents((current) =>
                current.filter(
                    (student) =>
                        student.id !== studentId
                )
            );
        } catch (err) {
            console.error(
                "Delete student error:",
                err
            );

            setError(
                "Unable to delete student."
            );
        } finally {
            setActionLoading(null);
            setDeleteTarget(null);
        }
    }

    /*
     * Statistics.
     */
    const statistics = useMemo(() => {
        const activeSchools =
            schools.filter((school) =>
                isActive(school.is_active)
            ).length;

        const activeStudents =
            students.filter((student) =>
                isActive(student.is_active)
            ).length;

        const assignedSatellites =
            students.filter(
                (student) =>
                    student.satellite_id &&
                    student.satellite_id.trim()
            ).length;

        return {
            totalSchools: schools.length,
            activeSchools,
            inactiveSchools:
                schools.length - activeSchools,

            totalStudents: students.length,
            activeStudents,
            inactiveStudents:
                students.length - activeStudents,

            assignedSatellites,
        };
    }, [schools, students]);

    /*
     * Filter schools.
     */
    const filteredSchools = useMemo(() => {
        const search =
            schoolSearch
                .trim()
                .toLowerCase();

        if (!search) {
            return schools;
        }

        return schools.filter(
            (school) =>
                school.school_name
                    .toLowerCase()
                    .includes(search) ||
                school.email
                    .toLowerCase()
                    .includes(search) ||
                school.phone
                    .toLowerCase()
                    .includes(search)
        );
    }, [schools, schoolSearch]);

    /*
     * Filter students.
     */
    const filteredStudents = useMemo(() => {
        const search =
            studentSearch
                .trim()
                .toLowerCase();

        return students.filter((student) => {
            const matchesSearch =
                !search ||
                student.student_name
                    .toLowerCase()
                    .includes(search) ||
                student.username
                    .toLowerCase()
                    .includes(search) ||
                String(student.school_id)
                    .includes(search) ||
                (
                    student.satellite_id || ""
                )
                    .toLowerCase()
                    .includes(search);

            const matchesSchool =
                studentSchoolFilter === "all" ||
                String(student.school_id) ===
                studentSchoolFilter;

            return (
                matchesSearch &&
                matchesSchool
            );
        });
    }, [
        students,
        studentSearch,
        studentSchoolFilter,
    ]);

    function getSchoolName(
        schoolId: number
    ) {
        const school = schools.find(
            (item) =>
                item.id === schoolId
        );

        return school
            ? school.school_name
            : `School #${schoolId}`;
    }

    function formatDate(
        date: string
    ) {
        return new Date(date).toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    }

    function renderStatus(
        active: number | boolean
    ) {
        return (
            <span
                className={
                    isActive(active)
                        ? "status active"
                        : "status inactive"
                }
            >
                {isActive(active)
                    ? "Active"
                    : "Inactive"}
            </span>
        );
    }

    if (loading) {
        return (
            <>
                <style>{styles}</style>

                <div className="admin-loading">
                    <div className="spinner" />
                    <p>
                        Loading admin dashboard...
                    </p>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{styles}</style>

            <div className="admin-layout">
                {/* Sidebar */}
                <aside className="sidebar">
                    <div className="brand">
                        <div className="brand-icon">
                            A
                        </div>

                        <div>
                            <strong>
                                Admin Panel
                            </strong>

                            <span>
                                Satellite System
                            </span>
                        </div>
                    </div>

                    <nav className="navigation">
                        <button
                            className={
                                activeSection ===
                                    "overview"
                                    ? "nav-item active-nav"
                                    : "nav-item"
                            }
                            onClick={() =>
                                setActiveSection(
                                    "overview"
                                )
                            }
                        >
                            <span>⌂</span>
                            Overview
                        </button>

                        <button
                            className={
                                activeSection ===
                                    "schools"
                                    ? "nav-item active-nav"
                                    : "nav-item"
                            }
                            onClick={() =>
                                setActiveSection(
                                    "schools"
                                )
                            }
                        >
                            <span>▣</span>
                            Schools
                            <b>
                                {schools.length}
                            </b>
                        </button>

                        <button
                            className={
                                activeSection ===
                                    "students"
                                    ? "nav-item active-nav"
                                    : "nav-item"
                            }
                            onClick={() =>
                                setActiveSection(
                                    "students"
                                )
                            }
                        >
                            <span>♙</span>
                            Students
                            <b>
                                {students.length}
                            </b>
                        </button>
                    </nav>

                    <div className="sidebar-bottom">
                        <div className="admin-mini">
                            <div className="avatar">
                                {admin?.username
                                    ?.charAt(0)
                                    .toUpperCase() ||
                                    "A"}
                            </div>

                            <div>
                                <strong>
                                    {admin?.username ||
                                        "Administrator"}
                                </strong>

                                <span>
                                    Administrator
                                </span>
                            </div>
                        </div>

                        <button
                            className="logout-button"
                            onClick={
                                handleLogout
                            }
                            disabled={
                                actionLoading ===
                                "logout"
                            }
                        >
                            {actionLoading ===
                                "logout"
                                ? "Logging out..."
                                : "Logout"}
                        </button>
                    </div>
                </aside>

                {/* Main */}
                <main className="main-content">
                    <header className="topbar">
                        <div>
                            <h1>
                                {activeSection ===
                                    "overview"
                                    ? "Dashboard"
                                    : activeSection ===
                                        "schools"
                                        ? "Schools"
                                        : "Students"}
                            </h1>

                            <p>
                                Manage your
                                platform from
                                one place.
                            </p>
                        </div>

                        <button
                            className="refresh-button"
                            onClick={
                                loadDashboard
                            }
                            disabled={loading}
                        >
                            ↻ Refresh
                        </button>
                    </header>

                    {error && (
                        <div className="error-box">
                            <span>
                                {error}
                            </span>

                            <button
                                onClick={() =>
                                    setError("")
                                }
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* OVERVIEW */}
                    {activeSection ===
                        "overview" && (
                            <>
                                <section className="stats-grid">
                                    <div className="stat-card">
                                        <div className="stat-icon">
                                            S
                                        </div>

                                        <div>
                                            <span>
                                                Total
                                                Schools
                                            </span>

                                            <strong>
                                                {
                                                    statistics.totalSchools
                                                }
                                            </strong>

                                            <small>
                                                {
                                                    statistics.activeSchools
                                                }{" "}
                                                active
                                            </small>
                                        </div>
                                    </div>

                                    <div className="stat-card">
                                        <div className="stat-icon">
                                            ST
                                        </div>

                                        <div>
                                            <span>
                                                Total
                                                Students
                                            </span>

                                            <strong>
                                                {
                                                    statistics.totalStudents
                                                }
                                            </strong>

                                            <small>
                                                {
                                                    statistics.activeStudents
                                                }{" "}
                                                active
                                            </small>
                                        </div>
                                    </div>

                                    <div className="stat-card">
                                        <div className="stat-icon">
                                            A
                                        </div>

                                        <div>
                                            <span>
                                                Active
                                                Accounts
                                            </span>

                                            <strong>
                                                {statistics.activeSchools +
                                                    statistics.activeStudents}
                                            </strong>

                                            <small>
                                                Schools +
                                                Students
                                            </small>
                                        </div>
                                    </div>

                                    <div className="stat-card">
                                        <div className="stat-icon">
                                            SAT
                                        </div>

                                        <div>
                                            <span>
                                                Assigned
                                                Satellites
                                            </span>

                                            <strong>
                                                {
                                                    statistics.assignedSatellites
                                                }
                                            </strong>

                                            <small>
                                                Student
                                                assignments
                                            </small>
                                        </div>
                                    </div>
                                </section>

                                <section className="overview-grid">
                                    <div className="panel">
                                        <div className="panel-header">
                                            <div>
                                                <h2>
                                                    Recent
                                                    Schools
                                                </h2>

                                                <p>
                                                    Latest
                                                    registered
                                                    schools
                                                </p>
                                            </div>

                                            <button
                                                className="text-button"
                                                onClick={() =>
                                                    setActiveSection(
                                                        "schools"
                                                    )
                                                }
                                            >
                                                View all
                                            </button>
                                        </div>

                                        {schools.length ===
                                            0 ? (
                                            <div className="empty-state">
                                                No schools
                                                registered.
                                            </div>
                                        ) : (
                                            <div className="recent-list">
                                                {[
                                                    ...schools,
                                                ]
                                                    .sort(
                                                        (
                                                            a,
                                                            b
                                                        ) =>
                                                            new Date(
                                                                b.created_at
                                                            ).getTime() -
                                                            new Date(
                                                                a.created_at
                                                            ).getTime()
                                                    )
                                                    .slice(
                                                        0,
                                                        5
                                                    )
                                                    .map(
                                                        (
                                                            school
                                                        ) => (
                                                            <div
                                                                className="recent-row"
                                                                key={
                                                                    school.id
                                                                }
                                                            >
                                                                <div className="row-avatar">
                                                                    {school.school_name
                                                                        .charAt(
                                                                            0
                                                                        )
                                                                        .toUpperCase()}
                                                                </div>

                                                                <div className="row-info">
                                                                    <strong>
                                                                        {
                                                                            school.school_name
                                                                        }
                                                                    </strong>

                                                                    <span>
                                                                        {
                                                                            school.email
                                                                        }
                                                                    </span>
                                                                </div>

                                                                {renderStatus(
                                                                    school.is_active
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="panel">
                                        <div className="panel-header">
                                            <div>
                                                <h2>
                                                    Recent
                                                    Students
                                                </h2>

                                                <p>
                                                    Latest
                                                    student
                                                    accounts
                                                </p>
                                            </div>

                                            <button
                                                className="text-button"
                                                onClick={() =>
                                                    setActiveSection(
                                                        "students"
                                                    )
                                                }
                                            >
                                                View all
                                            </button>
                                        </div>

                                        {students.length ===
                                            0 ? (
                                            <div className="empty-state">
                                                No students
                                                registered.
                                            </div>
                                        ) : (
                                            <div className="recent-list">
                                                {[
                                                    ...students,
                                                ]
                                                    .sort(
                                                        (
                                                            a,
                                                            b
                                                        ) =>
                                                            new Date(
                                                                b.created_at
                                                            ).getTime() -
                                                            new Date(
                                                                a.created_at
                                                            ).getTime()
                                                    )
                                                    .slice(
                                                        0,
                                                        5
                                                    )
                                                    .map(
                                                        (
                                                            student
                                                        ) => (
                                                            <div
                                                                className="recent-row"
                                                                key={
                                                                    student.id
                                                                }
                                                            >
                                                                <div className="row-avatar">
                                                                    {student.student_name
                                                                        .charAt(
                                                                            0
                                                                        )
                                                                        .toUpperCase()}
                                                                </div>

                                                                <div className="row-info">
                                                                    <strong>
                                                                        {
                                                                            student.student_name
                                                                        }
                                                                    </strong>

                                                                    <span>
                                                                        @
                                                                        {
                                                                            student.username
                                                                        }
                                                                    </span>
                                                                </div>

                                                                {renderStatus(
                                                                    student.is_active
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </>
                        )}

                    {/* SCHOOLS */}
                    {activeSection ===
                        "schools" && (
                            <section className="panel">
                                <div className="panel-header management-header">
                                    <div>
                                        <h2>
                                            School
                                            Management
                                        </h2>

                                        <p>
                                            Manage registered
                                            school accounts.
                                        </p>
                                    </div>

                                    <div className="search-wrapper">
                                        <span>⌕</span>

                                        <input
                                            type="search"
                                            placeholder="Search schools..."
                                            value={
                                                schoolSearch
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setSchoolSearch(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                        />
                                    </div>
                                </div>

                                {filteredSchools.length ===
                                    0 ? (
                                    <div className="empty-state large">
                                        <strong>
                                            No schools
                                            found
                                        </strong>

                                        <span>
                                            Try a different
                                            search.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="table-wrapper">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>
                                                        School
                                                    </th>

                                                    <th>
                                                        Contact
                                                    </th>

                                                    <th>
                                                        Status
                                                    </th>

                                                    <th>
                                                        Registered
                                                    </th>

                                                    <th>
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {filteredSchools.map(
                                                    (
                                                        school
                                                    ) => {
                                                        const active =
                                                            isActive(
                                                                school.is_active
                                                            );

                                                        return (
                                                            <tr
                                                                key={
                                                                    school.id
                                                                }
                                                            >
                                                                <td>
                                                                    <div className="table-person">
                                                                        <div className="row-avatar">
                                                                            {school.school_name
                                                                                .charAt(
                                                                                    0
                                                                                )
                                                                                .toUpperCase()}
                                                                        </div>

                                                                        <div>
                                                                            <strong>
                                                                                {
                                                                                    school.school_name
                                                                                }
                                                                            </strong>

                                                                            <span>
                                                                                ID #
                                                                                {
                                                                                    school.id
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td>
                                                                    <div className="contact-info">
                                                                        <span>
                                                                            {
                                                                                school.email
                                                                            }
                                                                        </span>

                                                                        <span>
                                                                            {
                                                                                school.phone
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                <td>
                                                                    {renderStatus(
                                                                        school.is_active
                                                                    )}
                                                                </td>

                                                                <td>
                                                                    {
                                                                        formatDate(
                                                                            school.created_at
                                                                        )
                                                                    }
                                                                </td>

                                                                <td>
                                                                    <div className="action-group">
                                                                        <button
                                                                            className={
                                                                                active
                                                                                    ? "action-button warning"
                                                                                    : "action-button success"
                                                                            }
                                                                            onClick={() =>
                                                                                toggleSchool(
                                                                                    school
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                actionLoading !==
                                                                                null
                                                                            }
                                                                        >
                                                                            {actionLoading ===
                                                                                `school-${school.id}-${active ? "deactivate" : "activate"}`
                                                                                ? "..."
                                                                                : active
                                                                                    ? "Deactivate"
                                                                                    : "Activate"}
                                                                        </button>

                                                                        <button
                                                                            className="action-button danger"
                                                                            onClick={() =>
                                                                                setDeleteTarget(
                                                                                    {
                                                                                        type: "school",
                                                                                        id: school.id,
                                                                                        name: school.school_name,
                                                                                    }
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                actionLoading !==
                                                                                null
                                                                            }
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        )}

                    {/* STUDENTS */}
                    {activeSection ===
                        "students" && (
                            <section className="panel">
                                <div className="panel-header management-header">
                                    <div>
                                        <h2>
                                            Student
                                            Management
                                        </h2>

                                        <p>
                                            Manage all student
                                            accounts.
                                        </p>
                                    </div>

                                    <div className="filters">
                                        <div className="search-wrapper">
                                            <span>⌕</span>

                                            <input
                                                type="search"
                                                placeholder="Search students..."
                                                value={
                                                    studentSearch
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setStudentSearch(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                            />
                                        </div>

                                        <select
                                            value={
                                                studentSchoolFilter
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setStudentSchoolFilter(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                        >
                                            <option value="all">
                                                All schools
                                            </option>

                                            {schools.map(
                                                (
                                                    school
                                                ) => (
                                                    <option
                                                        key={
                                                            school.id
                                                        }
                                                        value={
                                                            school.id
                                                        }
                                                    >
                                                        {
                                                            school.school_name
                                                        }
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>
                                </div>

                                {filteredStudents.length ===
                                    0 ? (
                                    <div className="empty-state large">
                                        <strong>
                                            No students
                                            found
                                        </strong>

                                        <span>
                                            Try a different
                                            search or filter.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="table-wrapper">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>
                                                        Student
                                                    </th>

                                                    <th>
                                                        School
                                                    </th>

                                                    <th>
                                                        Satellite
                                                    </th>

                                                    <th>
                                                        Status
                                                    </th>

                                                    <th>
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {filteredStudents.map(
                                                    (
                                                        student
                                                    ) => {
                                                        const active =
                                                            isActive(
                                                                student.is_active
                                                            );

                                                        return (
                                                            <tr
                                                                key={
                                                                    student.id
                                                                }
                                                            >
                                                                <td>
                                                                    <div className="table-person">
                                                                        <div className="row-avatar">
                                                                            {student.student_name
                                                                                .charAt(
                                                                                    0
                                                                                )
                                                                                .toUpperCase()}
                                                                        </div>

                                                                        <div>
                                                                            <strong>
                                                                                {
                                                                                    student.student_name
                                                                                }
                                                                            </strong>

                                                                            <span>
                                                                                @
                                                                                {
                                                                                    student.username
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td>
                                                                    <div className="contact-info">
                                                                        <span>
                                                                            {
                                                                                getSchoolName(
                                                                                    student.school_id
                                                                                )
                                                                            }
                                                                        </span>

                                                                        <span>
                                                                            School
                                                                            #
                                                                            {
                                                                                student.school_id
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                <td>
                                                                    {student.satellite_id ? (
                                                                        <span className="satellite-id">
                                                                            {
                                                                                student.satellite_id
                                                                            }
                                                                        </span>
                                                                    ) : (
                                                                        <span className="not-assigned">
                                                                            Not
                                                                            assigned
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                <td>
                                                                    {renderStatus(
                                                                        student.is_active
                                                                    )}
                                                                </td>

                                                                <td>
                                                                    <div className="action-group">
                                                                        <button
                                                                            className={
                                                                                active
                                                                                    ? "action-button warning"
                                                                                    : "action-button success"
                                                                            }
                                                                            onClick={() =>
                                                                                toggleStudent(
                                                                                    student
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                actionLoading !==
                                                                                null
                                                                            }
                                                                        >
                                                                            {actionLoading ===
                                                                                `student-${student.id}-${active ? "deactivate" : "activate"}`
                                                                                ? "..."
                                                                                : active
                                                                                    ? "Deactivate"
                                                                                    : "Activate"}
                                                                        </button>

                                                                        <button
                                                                            className="action-button danger"
                                                                            onClick={() =>
                                                                                setDeleteTarget(
                                                                                    {
                                                                                        type: "student",
                                                                                        id: student.id,
                                                                                        name: student.student_name,
                                                                                    }
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                actionLoading !==
                                                                                null
                                                                            }
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        )}
                </main>
            </div>

            {/* DELETE CONFIRMATION */}
            {deleteTarget && (
                <div
                    className="modal-backdrop"
                    onClick={() =>
                        setDeleteTarget(null)
                    }
                >
                    <div
                        className="delete-modal"
                        onClick={(event) =>
                            event.stopPropagation()
                        }
                    >
                        <div className="modal-icon">
                            !
                        </div>

                        <h2>
                            Delete{" "}
                            {deleteTarget.type ===
                                "school"
                                ? "school"
                                : "student"}
                            ?
                        </h2>

                        <p>
                            Are you sure you want
                            to permanently delete{" "}
                            <strong>
                                {
                                    deleteTarget.name
                                }
                            </strong>
                            ?
                        </p>

                        {deleteTarget.type ===
                            "school" && (
                                <div className="modal-warning">
                                    Deleting a school also
                                    removes its related
                                    student accounts.
                                </div>
                            )}

                        <div className="modal-actions">
                            <button
                                className="cancel-button"
                                onClick={() =>
                                    setDeleteTarget(
                                        null
                                    )
                                }
                            >
                                Cancel
                            </button>

                            <button
                                className="confirm-delete-button"
                                onClick={() => {
                                    if (
                                        deleteTarget.type ===
                                        "school"
                                    ) {
                                        deleteSchool(
                                            deleteTarget.id
                                        );
                                    } else {
                                        deleteStudent(
                                            deleteTarget.id
                                        );
                                    }
                                }}
                            >
                                {actionLoading
                                    ? "Deleting..."
                                    : "Delete permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const styles = `
* {
    box-sizing: border-box;
}

.admin-layout {
    min-height: 100vh;
    display: flex;
    background: #f5f6f8;
    color: #17202a;
    font-family:
        Inter,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

/* SIDEBAR */

.sidebar {
    width: 250px;
    min-height: 100vh;
    background: #111827;
    color: #fff;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
}

.brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 8px 28px;
}

.brand-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: #f59e0b;
    color: #111827;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
}

.brand strong,
.brand span,
.admin-mini strong,
.admin-mini span {
    display: block;
}

.brand strong {
    font-size: 15px;
}

.brand span {
    margin-top: 3px;
    color: #9ca3af;
    font-size: 11px;
}

.navigation {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.nav-item {
    width: 100%;
    border: 0;
    background: transparent;
    color: #9ca3af;
    padding: 12px 12px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 11px;
    font-size: 14px;
    cursor: pointer;
    text-align: left;
}

.nav-item:hover {
    background: #1f2937;
    color: #fff;
}

.nav-item span {
    width: 20px;
    text-align: center;
}

.nav-item b {
    margin-left: auto;
    font-size: 11px;
    font-weight: 600;
}

.active-nav {
    background: #f59e0b !important;
    color: #111827 !important;
}

.sidebar-bottom {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid #293241;
}

.admin-mini {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 4px 14px;
}

.avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #374151;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
}

.admin-mini strong {
    font-size: 12px;
}

.admin-mini span {
    margin-top: 2px;
    color: #9ca3af;
    font-size: 10px;
}

.logout-button {
    width: 100%;
    border: 1px solid #374151;
    background: transparent;
    color: #d1d5db;
    padding: 9px;
    border-radius: 7px;
    cursor: pointer;
}

.logout-button:hover {
    background: #1f2937;
    color: #fff;
}

/* MAIN */

.main-content {
    width: calc(100% - 250px);
    margin-left: 250px;
    padding: 32px;
}

.topbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 28px;
}

.topbar h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.5px;
}

.topbar p {
    margin: 5px 0 0;
    color: #6b7280;
    font-size: 13px;
}

.refresh-button {
    border: 1px solid #d7dbe2;
    background: #fff;
    color: #374151;
    padding: 9px 14px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 13px;
}

.refresh-button:hover {
    background: #f9fafb;
}

/* ERROR */

.error-box {
    background: #fff1f2;
    border: 1px solid #fecdd3;
    color: #be123c;
    padding: 11px 14px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
}

.error-box button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 18px;
}

/* STATS */

.stats-grid {
    display: grid;
    grid-template-columns:
        repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 22px;
}

.stat-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 19px;
    display: flex;
    align-items: center;
    gap: 14px;
}

.stat-icon {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 9px;
    background: #fff7e6;
    color: #d97706;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
}

.stat-card span,
.stat-card strong,
.stat-card small {
    display: block;
}

.stat-card span {
    color: #6b7280;
    font-size: 11px;
}

.stat-card strong {
    margin-top: 4px;
    font-size: 25px;
    line-height: 1;
}

.stat-card small {
    margin-top: 5px;
    color: #6b7280;
    font-size: 10px;
}

/* PANELS */

.panel {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
}

.overview-grid {
    display: grid;
    grid-template-columns:
        repeat(2, minmax(0, 1fr));
    gap: 20px;
}

.panel-header {
    padding: 20px;
    border-bottom: 1px solid #edf0f2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
}

.panel-header h2 {
    margin: 0;
    font-size: 15px;
}

.panel-header p {
    margin: 4px 0 0;
    color: #6b7280;
    font-size: 11px;
}

.text-button {
    border: 0;
    background: transparent;
    color: #b45309;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
}

.recent-list {
    padding: 4px 20px 10px;
}

.recent-row {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 13px 0;
    border-bottom: 1px solid #f0f1f3;
}

.recent-row:last-child {
    border-bottom: 0;
}

.row-avatar {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border-radius: 8px;
    background: #f3f4f6;
    color: #4b5563;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
}

.row-info {
    min-width: 0;
    flex: 1;
}

.row-info strong,
.row-info span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.row-info strong {
    font-size: 12px;
}

.row-info span {
    margin-top: 3px;
    color: #6b7280;
    font-size: 10px;
}

/* STATUS */

.status {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
}

.status.active {
    background: #ecfdf3;
    color: #15803d;
}

.status.inactive {
    background: #f3f4f6;
    color: #6b7280;
}

/* MANAGEMENT */

.management-header {
    align-items: flex-end;
}

.search-wrapper {
    width: 240px;
    height: 36px;
    border: 1px solid #d9dde3;
    border-radius: 7px;
    background: #fff;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 7px;
}

.search-wrapper span {
    color: #9ca3af;
    font-size: 18px;
}

.search-wrapper input {
    width: 100%;
    border: 0;
    outline: 0;
    font-size: 12px;
    background: transparent;
}

.filters {
    display: flex;
    gap: 8px;
}

.filters select {
    height: 36px;
    border: 1px solid #d9dde3;
    border-radius: 7px;
    background: #fff;
    padding: 0 10px;
    outline: 0;
    font-size: 12px;
    color: #374151;
}

/* TABLE */

.table-wrapper {
    width: 100%;
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    min-width: 850px;
}

th {
    background: #fafafa;
    color: #6b7280;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 12px 20px;
    border-bottom: 1px solid #e5e7eb;
}

td {
    padding: 14px 20px;
    border-bottom: 1px solid #edf0f2;
    font-size: 12px;
    vertical-align: middle;
}

tbody tr:hover {
    background: #fafafa;
}

.table-person {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 190px;
}

.table-person strong,
.table-person span {
    display: block;
}

.table-person strong {
    font-size: 12px;
}

.table-person span {
    margin-top: 3px;
    color: #6b7280;
    font-size: 10px;
}

.contact-info span {
    display: block;
}

.contact-info span + span {
    margin-top: 3px;
    color: #6b7280;
    font-size: 10px;
}

.action-group {
    display: flex;
    gap: 6px;
    white-space: nowrap;
}

.action-button {
    border: 1px solid;
    padding: 6px 9px;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
}

.action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.action-button.warning {
    border-color: #f3d29b;
    color: #a16207;
}

.action-button.warning:hover {
    background: #fffaf0;
}

.action-button.success {
    border-color: #bbebc8;
    color: #15803d;
}

.action-button.success:hover {
    background: #f0fdf4;
}

.action-button.danger {
    border-color: #fecdd3;
    color: #be123c;
}

.action-button.danger:hover {
    background: #fff1f2;
}

.satellite-id {
    display: inline-block;
    padding: 4px 7px;
    background: #f3f4f6;
    border-radius: 5px;
    font-family: monospace;
    font-size: 10px;
}

.not-assigned {
    color: #9ca3af;
    font-size: 10px;
}

/* EMPTY */

.empty-state {
    padding: 40px 20px;
    color: #9ca3af;
    text-align: center;
    font-size: 12px;
}

.empty-state.large {
    min-height: 220px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
}

.empty-state.large strong {
    color: #4b5563;
    font-size: 13px;
}

/* MODAL */

.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 100;
}

.delete-modal {
    width: 100%;
    max-width: 410px;
    background: #fff;
    border-radius: 12px;
    padding: 26px;
    box-shadow:
        0 20px 50px rgba(0, 0, 0, 0.18);
}

.modal-icon {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #fff1f2;
    color: #be123c;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    margin-bottom: 14px;
}

.delete-modal h2 {
    margin: 0;
    font-size: 18px;
}

.delete-modal p {
    color: #6b7280;
    line-height: 1.6;
    font-size: 13px;
    margin: 9px 0 15px;
}

.delete-modal p strong {
    color: #374151;
}

.modal-warning {
    background: #fff7ed;
    color: #9a3412;
    border: 1px solid #fed7aa;
    border-radius: 7px;
    padding: 10px;
    font-size: 11px;
    line-height: 1.5;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 22px;
}

.cancel-button,
.confirm-delete-button {
    padding: 9px 13px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
}

.cancel-button {
    border: 1px solid #d9dde3;
    background: #fff;
    color: #374151;
}

.confirm-delete-button {
    border: 1px solid #be123c;
    background: #be123c;
    color: #fff;
}

/* LOADING */

.admin-loading {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f5f6f8;
    color: #6b7280;
    font-size: 13px;
}

.spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #e5e7eb;
    border-top-color: #f59e0b;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 12px;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* RESPONSIVE */

@media (max-width: 1100px) {
    .stats-grid {
        grid-template-columns:
            repeat(2, minmax(0, 1fr));
    }

    .overview-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 800px) {
    .sidebar {
        width: 70px;
        padding: 18px 10px;
    }

    .brand {
        justify-content: center;
        padding-bottom: 25px;
    }

    .brand > div:last-child,
    .nav-item b,
    .nav-item:not(.active-nav) {
        /* keep nav icon available */
    }

    .brand strong,
    .brand span,
    .admin-mini > div:last-child,
    .logout-button {
        display: none;
    }

    .nav-item {
        justify-content: center;
        padding: 12px;
    }

    .main-content {
        width: calc(100% - 70px);
        margin-left: 70px;
        padding: 22px;
    }

    .management-header {
        align-items: stretch;
        flex-direction: column;
    }

    .search-wrapper {
        width: 100%;
    }

    .filters {
        width: 100%;
        flex-direction: column;
    }

    .filters select {
        width: 100%;
    }
}

@media (max-width: 600px) {
    .main-content {
        padding: 16px;
    }

    .topbar {
        align-items: center;
    }

    .topbar h1 {
        font-size: 23px;
    }

    .refresh-button {
        font-size: 11px;
        padding: 8px 10px;
    }

    .stats-grid {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .stat-card {
        padding: 15px;
    }

    .panel-header {
        padding: 16px;
    }

    .recent-list {
        padding-left: 16px;
        padding-right: 16px;
    }

    .status {
        font-size: 9px;
    }

    .delete-modal {
        padding: 20px;
    }
}
`;