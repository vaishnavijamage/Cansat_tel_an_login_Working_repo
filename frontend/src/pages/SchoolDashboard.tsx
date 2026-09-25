import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import SatelliteDashboard from "./SatelliteDashboard";

import {
    activateStudent,
    createStudent,
    deactivateStudent,
    deleteStudent,
    getSchoolStudents,
    logout,
} from "../services/api";

import {
    LayoutDashboard,
    Users,
    Satellite,
    Activity,
    LogOut,
    Menu,
    X,
    Plus,
    RefreshCw,
    UserCheck,
    UserX,
    ShieldCheck,
    Search,
    ChevronRight,
} from "lucide-react";


/* =========================================================
   TYPES
========================================================= */

type Student = {
    id: number;
    studentName: string;
    username: string;
    isActive: boolean | number;
    createdAt?: string;
    satelliteId?: string | null;
};

type Section =
    | "overview"
    | "students"
    | "satellites"
    | "satellite-data";


/* =========================================================
   HELPERS
========================================================= */

function isStudentActive(student: Student) {
    return (
        student.isActive === true ||
        Number(student.isActive) === 1
    );
}


/* =========================================================
   SCHOOL DASHBOARD
========================================================= */

export default function SchoolDashboard() {

    const navigate = useNavigate();


    /* =====================================================
       STATE
    ===================================================== */

    const [students, setStudents] =
        useState<Student[]>([]);

    const [isLoadingStudents, setIsLoadingStudents] =
        useState(true);

    const [studentName, setStudentName] =
        useState("");

    const [username, setUsername] =
        useState("");

    const [password, setPassword] =
        useState("");

    const [isAddingStudent, setIsAddingStudent] =
        useState(false);

    const [processingStudentId, setProcessingStudentId] =
        useState<number | null>(null);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");

    const [activeSection, setActiveSection] =
        useState<Section>("overview");

    const [sidebarOpen, setSidebarOpen] =
        useState(false);

    const [searchTerm, setSearchTerm] =
        useState("");


    /* =====================================================
       LOAD STUDENTS
    ===================================================== */

    const loadStudents = async () => {

        try {

            setIsLoadingStudents(true);
            setError("");

            const response =
                await getSchoolStudents();

            setStudents(
                response.students || []
            );

        } catch (error) {

            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to load students."
            );

        } finally {

            setIsLoadingStudents(false);

        }
    };


    /* =====================================================
       INITIAL LOAD
    ===================================================== */

    useEffect(() => {
        loadStudents();
    }, []);


    /* =====================================================
       STUDENT STATISTICS
    ===================================================== */

    const totalStudents =
        students.length;

    const activeStudents =
        students.filter(
            isStudentActive
        ).length;

    const inactiveStudents =
        students.filter(
            (student) =>
                !isStudentActive(student)
        ).length;


    /* =====================================================
       FILTER STUDENTS
    ===================================================== */

    const filteredStudents =
        useMemo(() => {

            const search =
                searchTerm
                    .trim()
                    .toLowerCase();

            if (!search) {
                return students;
            }

            return students.filter(
                (student) =>
                    student.studentName
                        .toLowerCase()
                        .includes(search) ||
                    student.username
                        .toLowerCase()
                        .includes(search)
            );

        }, [
            students,
            searchTerm,
        ]);


    /* =====================================================
       CLEAR MESSAGES
    ===================================================== */

    const clearMessages = () => {
        setError("");
        setSuccess("");
    };


    /* =====================================================
       ADD STUDENT
    ===================================================== */

    const handleAddStudent = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {

        e.preventDefault();

        clearMessages();

        const cleanName =
            studentName.trim();

        const cleanUsername =
            username
                .trim()
                .toLowerCase();


        if (
            !cleanName ||
            !cleanUsername ||
            !password
        ) {

            setError(
                "Please fill in all student fields."
            );

            return;
        }


        if (
            cleanName.length < 2 ||
            cleanName.length > 150
        ) {

            setError(
                "Student name must be between 2 and 150 characters."
            );

            return;
        }


        if (
            !/^[a-z0-9_.]{4,50}$/.test(
                cleanUsername
            )
        ) {

            setError(
                "Username must be 4-50 characters and may contain only letters, numbers, underscores and dots."
            );

            return;
        }


        if (
            password.length < 8 ||
            password.length > 128
        ) {

            setError(
                "Password must be between 8 and 128 characters."
            );

            return;
        }


        if (/\s/.test(password)) {

            setError(
                "Password must not contain spaces."
            );

            return;
        }


        try {

            setIsAddingStudent(true);

            const response =
                await createStudent({
                    studentName: cleanName,
                    username: cleanUsername,
                    password,
                });


            setSuccess(
                response.message ||
                "Student account created successfully."
            );


            setStudentName("");
            setUsername("");
            setPassword("");


            await loadStudents();

        } catch (error) {

            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to create student."
            );

        } finally {

            setIsAddingStudent(false);

        }
    };


    /* =====================================================
       ACTIVATE STUDENT
    ===================================================== */

    const handleActivateStudent = async (
        studentId: number
    ) => {

        try {

            clearMessages();

            setProcessingStudentId(
                studentId
            );

            const response =
                await activateStudent(
                    studentId
                );


            setSuccess(
                response.message ||
                "Student account activated successfully."
            );


            await loadStudents();

        } catch (error) {

            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to activate student."
            );

        } finally {

            setProcessingStudentId(null);

        }
    };


    /* =====================================================
       DEACTIVATE STUDENT
    ===================================================== */

    const handleDeactivateStudent = async (
        studentId: number
    ) => {

        const confirmed =
            window.confirm(
                "Are you sure you want to deactivate this student?"
            );


        if (!confirmed) {
            return;
        }


        try {

            clearMessages();

            setProcessingStudentId(
                studentId
            );

            const response =
                await deactivateStudent(
                    studentId
                );


            setSuccess(
                response.message ||
                "Student account deactivated successfully."
            );


            await loadStudents();

        } catch (error) {

            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to deactivate student."
            );

        } finally {

            setProcessingStudentId(null);

        }
    };


    /* =====================================================
   DELETE STUDENT
===================================================== */

    const handleDeleteStudent = async (
        studentId: number
    ) => {

        const confirmed =
            window.confirm(
                "Are you sure you want to permanently delete this student?"
            );

        if (!confirmed) {
            return;
        }

        try {

            clearMessages();

            setProcessingStudentId(studentId);

            const response =
                await deleteStudent(studentId);

            setSuccess(
                response.message ||
                "Student account deleted successfully."
            );

            await loadStudents();

        } catch (error) {

            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to delete student."
            );

        } finally {

            setProcessingStudentId(null);

        }
    };

    /* =====================================================
       LOGOUT
    ===================================================== */

    const handleLogout = async () => {

        try {

            await logout();

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

        } finally {

            navigate("/login", {
                replace: true,
            });

        }
    };


    /* =====================================================
       NAVIGATION
    ===================================================== */

    const changeSection = (
        section: Section
    ) => {

        clearMessages();

        setActiveSection(section);

        setSidebarOpen(false);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };


    /* =====================================================
       NAVIGATION ITEM
    ===================================================== */

    const NavigationItem = ({
        section,
        icon,
        label,
    }: {
        section: Section;
        icon: React.ReactNode;
        label: string;
    }) => (

        <button
            type="button"
            onClick={() =>
                changeSection(section)
            }
            className={`sd-nav-item ${activeSection === section
                ? "sd-nav-item-active"
                : ""
                }`}
        >

            <span className="sd-nav-icon">
                {icon}
            </span>

            <span>
                {label}
            </span>

            {activeSection === section && (
                <ChevronRight
                    size={17}
                    className="sd-nav-arrow"
                />
            )}

        </button>
    );


    /* =====================================================
       RENDER
    ===================================================== */

    return (

        <div className="school-dashboard-shell">


            {/* =================================================
               MOBILE OVERLAY
            ================================================= */}

            {sidebarOpen && (

                <button
                    type="button"
                    className="sd-sidebar-overlay"
                    aria-label="Close menu"
                    onClick={() =>
                        setSidebarOpen(false)
                    }
                />

            )}


            {/* =================================================
               SIDEBAR
            ================================================= */}

            <aside
                className={`sd-sidebar ${sidebarOpen
                    ? "sd-sidebar-open"
                    : ""
                    }`}
            >

                <div className="sd-sidebar-brand">

                    <div className="sd-brand-logo">
                        <Satellite size={24} />
                    </div>

                    <div>
                        <strong>
                            School Portal
                        </strong>

                        <span>
                            Education Management
                        </span>
                    </div>

                    <button
                        type="button"
                        className="sd-mobile-close"
                        onClick={() =>
                            setSidebarOpen(false)
                        }
                        aria-label="Close sidebar"
                    >
                        <X size={21} />
                    </button>

                </div>


                {/* Navigation */}

                <nav className="sd-navigation">

                    <div className="sd-nav-heading">
                        MAIN
                    </div>

                    <NavigationItem
                        section="overview"
                        icon={
                            <LayoutDashboard
                                size={19}
                            />
                        }
                        label="Overview"
                    />

                    <NavigationItem
                        section="students"
                        icon={
                            <Users size={19} />
                        }
                        label="Students"
                    />

                    <NavigationItem
                        section="satellites"
                        icon={
                            <Satellite
                                size={19}
                            />
                        }
                        label="Satellites"
                    />

                    <NavigationItem
                        section="satellite-data"
                        icon={
                            <Activity
                                size={19}
                            />
                        }
                        label="Satellite Data"
                    />

                </nav>


                {/* Sidebar bottom */}

                <div className="sd-sidebar-bottom">

                    <div className="sd-security-box">

                        <ShieldCheck size={20} />

                        <div>

                            <strong>
                                Secure Portal
                            </strong>

                            <span>
                                Your session is protected
                            </span>

                        </div>

                    </div>


                    <button
                        type="button"
                        className="sd-sidebar-logout"
                        onClick={
                            handleLogout
                        }
                    >

                        <LogOut size={18} />

                        Logout

                    </button>

                </div>

            </aside>


            {/* =================================================
               MAIN
            ================================================= */}

            <div className="sd-main">


                {/* =================================================
                   TOP BAR
                ================================================= */}

                <header className="sd-topbar">

                    <div className="sd-topbar-left">

                        <button
                            type="button"
                            className="sd-menu-button"
                            onClick={() =>
                                setSidebarOpen(
                                    true
                                )
                            }
                            aria-label="Open menu"
                        >
                            <Menu size={23} />
                        </button>


                        <div>

                            <span className="sd-breadcrumb">
                                School Portal
                            </span>

                            <h1>
                                {
                                    activeSection ===
                                        "overview"
                                        ? "Dashboard"
                                        : activeSection ===
                                            "students"
                                            ? "Student Management"
                                            : activeSection ===
                                                "satellites"
                                                ? "Satellites"
                                                : "Satellite Data"
                                }
                            </h1>

                        </div>

                    </div>


                    <div className="sd-topbar-right">

                        <div className="sd-online">

                            <span />

                            System Online

                        </div>

                    </div>

                </header>


                {/* =================================================
                   CONTENT
                ================================================= */}

                <main className="sd-content">


                    {/* =================================================
                       ALERTS
                    ================================================= */}

                    {error && (

                        <div
                            className="sd-alert sd-alert-error"
                            role="alert"
                        >

                            <X size={18} />

                            <span>
                                {error}
                            </span>

                            <button
                                type="button"
                                onClick={
                                    clearMessages
                                }
                            >
                                ×
                            </button>

                        </div>

                    )}


                    {success && (

                        <div
                            className="sd-alert sd-alert-success"
                            role="status"
                        >

                            <UserCheck size={18} />

                            <span>
                                {success}
                            </span>

                            <button
                                type="button"
                                onClick={
                                    clearMessages
                                }
                            >
                                ×
                            </button>

                        </div>

                    )}


                    {/* =================================================
                       OVERVIEW
                    ================================================= */}

                    {activeSection ===
                        "overview" && (

                            <>

                                <section className="sd-welcome">

                                    <div>

                                        <span>
                                            SCHOOL ADMINISTRATION
                                        </span>

                                        <h2>
                                            Welcome to your
                                            dashboard
                                        </h2>

                                        <p>
                                            Manage your
                                            students and
                                            monitor your
                                            school's
                                            satellite
                                            activities from
                                            one place.
                                        </p>

                                    </div>

                                    <div className="sd-welcome-icon">
                                        <Satellite
                                            size={54}
                                        />
                                    </div>

                                </section>


                                {/* Statistics */}

                                <section className="sd-stat-grid">

                                    <div className="sd-stat-card">

                                        <div className="sd-stat-icon">
                                            <Users size={23} />
                                        </div>

                                        <div>

                                            <span>
                                                Total Students
                                            </span>

                                            <strong>
                                                {totalStudents}
                                            </strong>

                                        </div>

                                    </div>


                                    <div className="sd-stat-card">

                                        <div className="sd-stat-icon sd-stat-success">
                                            <UserCheck
                                                size={23}
                                            />
                                        </div>

                                        <div>

                                            <span>
                                                Active Students
                                            </span>

                                            <strong>
                                                {activeStudents}
                                            </strong>

                                        </div>

                                    </div>


                                    <div className="sd-stat-card">

                                        <div className="sd-stat-icon sd-stat-danger">
                                            <UserX
                                                size={23}
                                            />
                                        </div>

                                        <div>

                                            <span>
                                                Inactive Students
                                            </span>

                                            <strong>
                                                {inactiveStudents}
                                            </strong>

                                        </div>

                                    </div>


                                    <div className="sd-stat-card">

                                        <div className="sd-stat-icon sd-stat-purple">
                                            <Satellite
                                                size={23}
                                            />
                                        </div>

                                        <div>

                                            <span>
                                                School Satellites
                                            </span>

                                            <strong>
                                                —
                                            </strong>

                                        </div>

                                    </div>

                                </section>


                                {/* Quick Actions */}

                                <section className="sd-section-card">

                                    <div className="sd-section-heading">

                                        <div>

                                            <span>
                                                QUICK ACTIONS
                                            </span>

                                            <h3>
                                                Manage your school
                                            </h3>

                                        </div>

                                    </div>


                                    <div className="sd-quick-grid">

                                        <button
                                            type="button"
                                            onClick={() =>
                                                changeSection(
                                                    "students"
                                                )
                                            }
                                            className="sd-quick-card"
                                        >

                                            <div className="sd-quick-icon">
                                                <Users size={22} />
                                            </div>

                                            <div>

                                                <strong>
                                                    Manage Students
                                                </strong>

                                                <span>
                                                    Add, activate
                                                    or deactivate
                                                    student
                                                    accounts.
                                                </span>

                                            </div>

                                            <ChevronRight
                                                size={19}
                                            />

                                        </button>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                changeSection(
                                                    "satellite-data"
                                                )
                                            }
                                            className="sd-quick-card"
                                        >

                                            <div className="sd-quick-icon">
                                                <Activity
                                                    size={22}
                                                />
                                            </div>

                                            <div>

                                                <strong>
                                                    View Satellite
                                                    Data
                                                </strong>

                                                <span>
                                                    Monitor your
                                                    school's
                                                    satellite
                                                    telemetry.
                                                </span>

                                            </div>

                                            <ChevronRight
                                                size={19}
                                            />

                                        </button>

                                    </div>

                                </section>


                                {/* Recent Students */}

                                <section className="sd-section-card">

                                    <div className="sd-section-heading">

                                        <div>

                                            <span>
                                                STUDENTS
                                            </span>

                                            <h3>
                                                Recent student
                                                accounts
                                            </h3>

                                        </div>

                                        <button
                                            type="button"
                                            className="sd-text-button"
                                            onClick={() =>
                                                changeSection(
                                                    "students"
                                                )
                                            }
                                        >
                                            View all
                                            <ChevronRight
                                                size={16}
                                            />
                                        </button>

                                    </div>


                                    {isLoadingStudents ? (

                                        <div className="sd-loading">
                                            <RefreshCw
                                                size={19}
                                                className="sd-spin"
                                            />
                                            Loading students...
                                        </div>

                                    ) : students.length ===
                                        0 ? (

                                        <div className="sd-empty">

                                            <Users size={30} />

                                            <strong>
                                                No students yet
                                            </strong>

                                            <span>
                                                Add your first
                                                student account
                                                to get started.
                                            </span>

                                        </div>

                                    ) : (

                                        <div className="sd-mini-table">

                                            {students
                                                .slice(0, 5)
                                                .map(
                                                    (
                                                        student
                                                    ) => {

                                                        const active =
                                                            isStudentActive(
                                                                student
                                                            );

                                                        return (

                                                            <div
                                                                className="sd-mini-row"
                                                                key={
                                                                    student.id
                                                                }
                                                            >

                                                                <div className="sd-student-avatar">
                                                                    {student.studentName
                                                                        .charAt(
                                                                            0
                                                                        )
                                                                        .toUpperCase()}
                                                                </div>

                                                                <div className="sd-mini-student">

                                                                    <strong>
                                                                        {
                                                                            student.studentName
                                                                        }
                                                                    </strong>

                                                                    <span>
                                                                        @
                                                                        {
                                                                            student.username
                                                                        }
                                                                    </span>

                                                                </div>

                                                                <span
                                                                    className={
                                                                        active
                                                                            ? "sd-status sd-status-active"
                                                                            : "sd-status sd-status-inactive"
                                                                    }
                                                                >
                                                                    {active
                                                                        ? "Active"
                                                                        : "Inactive"}
                                                                </span>

                                                            </div>

                                                        );

                                                    }
                                                )}

                                        </div>

                                    )}

                                </section>

                            </>

                        )}


                    {/* =================================================
                       STUDENTS
                    ================================================= */}

                    {activeSection ===
                        "students" && (

                            <>

                                <div className="sd-page-heading">

                                    <div>

                                        <span>
                                            STUDENT MANAGEMENT
                                        </span>

                                        <h2>
                                            Students
                                        </h2>

                                        <p>
                                            Create and manage
                                            student accounts
                                            belonging to your
                                            school.
                                        </p>

                                    </div>

                                    <button
                                        type="button"
                                        className="sd-primary-button"
                                        onClick={() =>
                                            document
                                                .getElementById(
                                                    "add-student-form"
                                                )
                                                ?.scrollIntoView({
                                                    behavior:
                                                        "smooth",
                                                })
                                        }
                                    >

                                        <Plus size={18} />

                                        Add Student

                                    </button>

                                </div>


                                {/* Add Student */}

                                <section
                                    id="add-student-form"
                                    className="sd-section-card"
                                >

                                    <div className="sd-section-heading">

                                        <div>

                                            <span>
                                                NEW ACCOUNT
                                            </span>

                                            <h3>
                                                Add a student
                                            </h3>

                                            <p>
                                                Create login
                                                credentials
                                                for a new
                                                student.
                                            </p>

                                        </div>

                                    </div>


                                    <form
                                        onSubmit={
                                            handleAddStudent
                                        }
                                        className="sd-student-form"
                                        noValidate
                                    >

                                        <div className="sd-form-field">

                                            <label htmlFor="studentName">
                                                Student Name
                                            </label>

                                            <input
                                                id="studentName"
                                                type="text"
                                                placeholder="Enter student's full name"
                                                value={
                                                    studentName
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    setStudentName(
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                                maxLength={
                                                    150
                                                }
                                            />

                                        </div>


                                        <div className="sd-form-field">

                                            <label htmlFor="studentUsername">
                                                Username
                                            </label>

                                            <input
                                                id="studentUsername"
                                                type="text"
                                                placeholder="e.g. student.john"
                                                value={
                                                    username
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    setUsername(
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                                maxLength={
                                                    50
                                                }
                                            />

                                        </div>


                                        <div className="sd-form-field">

                                            <label htmlFor="studentPassword">
                                                Initial Password
                                            </label>

                                            <input
                                                id="studentPassword"
                                                type="password"
                                                placeholder="Minimum 8 characters"
                                                value={
                                                    password
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    setPassword(
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                                maxLength={
                                                    128
                                                }
                                            />

                                        </div>


                                        <button
                                            type="submit"
                                            className="sd-primary-button sd-form-button"
                                            disabled={
                                                isAddingStudent
                                            }
                                        >

                                            {isAddingStudent ? (

                                                <>
                                                    <RefreshCw
                                                        size={18}
                                                        className="sd-spin"
                                                    />

                                                    Creating...

                                                </>

                                            ) : (

                                                <>
                                                    <Plus
                                                        size={18}
                                                    />

                                                    Create Student

                                                </>

                                            )}

                                        </button>

                                    </form>

                                </section>


                                {/* Student List */}

                                <section className="sd-section-card">

                                    <div className="sd-section-heading sd-student-list-heading">

                                        <div>

                                            <span>
                                                DIRECTORY
                                            </span>

                                            <h3>
                                                Student Accounts
                                            </h3>

                                        </div>


                                        <button
                                            type="button"
                                            className="sd-refresh-button"
                                            onClick={
                                                loadStudents
                                            }
                                            disabled={
                                                isLoadingStudents
                                            }
                                        >

                                            <RefreshCw
                                                size={17}
                                                className={
                                                    isLoadingStudents
                                                        ? "sd-spin"
                                                        : ""
                                                }
                                            />

                                            Refresh

                                        </button>

                                    </div>


                                    <div className="sd-student-toolbar">

                                        <div className="sd-search">

                                            <Search
                                                size={18}
                                            />

                                            <input
                                                type="search"
                                                placeholder="Search students..."
                                                value={
                                                    searchTerm
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    setSearchTerm(
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                            />

                                        </div>

                                        <span>
                                            {filteredStudents.length}{" "}
                                            of{" "}
                                            {students.length}{" "}
                                            students
                                        </span>

                                    </div>


                                    {isLoadingStudents ? (

                                        <div className="sd-loading">

                                            <RefreshCw
                                                size={20}
                                                className="sd-spin"
                                            />

                                            Loading student
                                            accounts...

                                        </div>

                                    ) : filteredStudents.length ===
                                        0 ? (

                                        <div className="sd-empty">

                                            <Users size={32} />

                                            <strong>
                                                No students found
                                            </strong>

                                            <span>
                                                Try a different
                                                search or add a
                                                new student.
                                            </span>

                                        </div>

                                    ) : (

                                        <div className="sd-table-wrapper">

                                            <table className="sd-table">

                                                <thead>

                                                    <tr>

                                                        <th>
                                                            Student
                                                        </th>

                                                        <th>
                                                            Username
                                                        </th>

                                                        <th>
                                                            SATELLITE ID

                                                        </th>

                                                        <th>
                                                            Status
                                                        </th>

                                                        <th>
                                                            Created
                                                        </th>

                                                        <th>
                                                            Action
                                                        </th>

                                                    </tr>

                                                </thead>

                                                <tbody>

                                                    {filteredStudents.map(
                                                        (
                                                            student
                                                        ) => {

                                                            const active =
                                                                isStudentActive(
                                                                    student
                                                                );

                                                            const processing =
                                                                processingStudentId ===
                                                                student.id;

                                                            return (

                                                                <tr
                                                                    key={
                                                                        student.id
                                                                    }
                                                                >

                                                                    <td>

                                                                        <div className="sd-table-student">

                                                                            <div className="sd-student-avatar">
                                                                                {student.studentName
                                                                                    .charAt(
                                                                                        0
                                                                                    )
                                                                                    .toUpperCase()}
                                                                            </div>

                                                                            <div>

                                                                                <strong>
                                                                                    {
                                                                                        student.studentName
                                                                                    }
                                                                                </strong>

                                                                                <span>
                                                                                    Student
                                                                                    ID #
                                                                                    {
                                                                                        student.id
                                                                                    }
                                                                                </span>

                                                                            </div>

                                                                        </div>

                                                                    </td>


                                                                    <td>
                                                                        <span className="sd-username">
                                                                            @
                                                                            {
                                                                                student.username
                                                                            }
                                                                        </span>
                                                                    </td>

                                                                    <td>
                                                                        {student.satelliteId || "—"}
                                                                    </td>

                                                                    <td>

                                                                        <span
                                                                            className={
                                                                                active
                                                                                    ? "sd-status sd-status-active"
                                                                                    : "sd-status sd-status-inactive"
                                                                            }
                                                                        >

                                                                            <span />

                                                                            {active
                                                                                ? "Active"
                                                                                : "Inactive"}

                                                                        </span>

                                                                    </td>


                                                                    <td>
                                                                        {student.createdAt
                                                                            ? new Date(
                                                                                student.createdAt
                                                                            ).toLocaleDateString(
                                                                                "en-IN",
                                                                                {
                                                                                    day: "2-digit",
                                                                                    month: "short",
                                                                                    year: "numeric",
                                                                                }
                                                                            )
                                                                            : "-"}
                                                                    </td>

                                                                    <td>
                                                                        <div style={{
                                                                            display: "flex",
                                                                            gap: "7px",
                                                                            alignItems: "center",
                                                                            flexWrap: "wrap",
                                                                        }}>

                                                                            {active ? (

                                                                                <button
                                                                                    type="button"
                                                                                    className="sd-action-danger"
                                                                                    disabled={processing}
                                                                                    onClick={() =>
                                                                                        handleDeactivateStudent(
                                                                                            student.id
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <UserX size={16} />

                                                                                    {processing
                                                                                        ? "Processing..."
                                                                                        : "Deactivate"}
                                                                                </button>

                                                                            ) : (

                                                                                <button
                                                                                    type="button"
                                                                                    className="sd-action-success"
                                                                                    disabled={processing}
                                                                                    onClick={() =>
                                                                                        handleActivateStudent(
                                                                                            student.id
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <UserCheck size={16} />

                                                                                    {processing
                                                                                        ? "Processing..."
                                                                                        : "Activate"}
                                                                                </button>

                                                                            )}

                                                                            <button
                                                                                type="button"
                                                                                className="sd-action-delete"
                                                                                disabled={processing}
                                                                                onClick={() =>
                                                                                    handleDeleteStudent(
                                                                                        student.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                <X size={16} />

                                                                                {processing
                                                                                    ? "Processing..."
                                                                                    : "Delete"}
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

                            </>

                        )}


                    {/* =================================================
                       SATELLITES
                    ================================================= */}

                    {activeSection ===
                        "satellites" && (

                            <>

                                <div className="sd-page-heading">

                                    <div>

                                        <span>
                                            SPACE PROGRAM
                                        </span>

                                        <h2>
                                            School Satellites
                                        </h2>

                                        <p>
                                            View satellites
                                            associated with
                                            your school.
                                        </p>

                                    </div>

                                </div>


                                <section className="sd-section-card">

                                    <div className="sd-empty-large">

                                        <div className="sd-large-icon">
                                            <Satellite
                                                size={38}
                                            />
                                        </div>

                                        <h3>
                                            Satellite Management
                                        </h3>

                                        <p>
                                            Your school's
                                            satellite
                                            information will
                                            appear here when
                                            satellites are
                                            connected to the
                                            system.
                                        </p>

                                        <button
                                            type="button"
                                            className="sd-primary-button"
                                            onClick={() =>
                                                changeSection(
                                                    "satellite-data"
                                                )
                                            }
                                        >

                                            <Activity
                                                size={18}
                                            />

                                            View Satellite Data

                                        </button>

                                    </div>

                                </section>

                            </>

                        )}


                    {/* =================================================
                       SATELLITE DATA
                    ================================================= */}

                    {activeSection ===
                        "satellite-data" && (

                            <>

                                <div className="sd-page-heading">

                                    <div>

                                        <span>
                                            TELEMETRY
                                        </span>

                                        <h2>
                                            Satellite Data
                                        </h2>

                                        <p>
                                            Monitor telemetry
                                            and satellite
                                            information
                                            belonging to your
                                            school.
                                        </p>

                                    </div>

                                </div>


                                <section className="sd-satellite-container">

                                    <SatelliteDashboard />

                                </section>

                            </>

                        )}

                </main>

            </div>


            {/* =================================================
               STYLES
            ================================================= */}

            <style>{`

                * {
                    box-sizing: border-box;
                }

                .school-dashboard-shell {
                    min-height: 100vh;
                    background: #f5f7fb;
                    color: #172033;
                    display: flex;
                    font-family:
                        Inter,
                        ui-sans-serif,
                        system-ui,
                        -apple-system,
                        BlinkMacSystemFont,
                        "Segoe UI",
                        sans-serif;
                }


                /* =================================================
                   SIDEBAR
                ================================================= */

                .sd-sidebar {
                    width: 270px;
                    min-width: 270px;
                    background: #101827;
                    color: #fff;
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    position: sticky;
                    top: 0;
                    height: 100vh;
                    z-index: 100;
                }

                .sd-sidebar-brand {
                    min-height: 82px;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border-bottom: 1px solid rgba(255,255,255,.08);
                }

                .sd-brand-logo {
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    display: grid;
                    place-items: center;
                    background: #f97316;
                    flex-shrink: 0;
                }

                .sd-sidebar-brand strong {
                    display: block;
                    font-size: 15px;
                    letter-spacing: .1px;
                }

                .sd-sidebar-brand span {
                    display: block;
                    margin-top: 3px;
                    color: #8995aa;
                    font-size: 11px;
                }

                .sd-navigation {
                    padding: 25px 13px;
                    flex: 1;
                }

                .sd-nav-heading {
                    padding: 0 12px 10px;
                    color: #647087;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 1.3px;
                }

                .sd-nav-item {
                    width: 100%;
                    border: 0;
                    background: transparent;
                    color: #aab4c5;
                    min-height: 48px;
                    border-radius: 10px;
                    padding: 0 12px;
                    margin-bottom: 5px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    text-align: left;
                    font-size: 13px;
                    transition: .2s ease;
                }

                .sd-nav-item:hover {
                    color: #fff;
                    background: rgba(255,255,255,.06);
                }

                .sd-nav-item-active {
                    background: #f97316;
                    color: #fff;
                    box-shadow: 0 7px 20px rgba(249,115,22,.18);
                }

                .sd-nav-icon {
                    display: grid;
                    place-items: center;
                }

                .sd-nav-arrow {
                    margin-left: auto;
                }

                .sd-sidebar-bottom {
                    padding: 15px;
                    border-top: 1px solid rgba(255,255,255,.08);
                }

                .sd-security-box {
                    padding: 12px;
                    border-radius: 10px;
                    background: rgba(255,255,255,.04);
                    display: flex;
                    gap: 10px;
                    color: #9ca8bb;
                    margin-bottom: 10px;
                }

                .sd-security-box svg {
                    color: #22c55e;
                    flex-shrink: 0;
                }

                .sd-security-box strong {
                    display: block;
                    font-size: 11px;
                    color: #d8deea;
                }

                .sd-security-box span {
                    display: block;
                    font-size: 9px;
                    margin-top: 3px;
                }

                .sd-sidebar-logout {
                    width: 100%;
                    border: 0;
                    background: transparent;
                    color: #aab4c5;
                    min-height: 43px;
                    border-radius: 9px;
                    display: flex;
                    align-items: center;
                    gap: 11px;
                    padding: 0 12px;
                    cursor: pointer;
                    font-size: 13px;
                }

                .sd-sidebar-logout:hover {
                    color: #fff;
                    background: rgba(239,68,68,.12);
                }


                /* =================================================
                   MAIN
                ================================================= */

                .sd-main {
                    flex: 1;
                    min-width: 0;
                }

                .sd-topbar {
                    height: 82px;
                    background: #fff;
                    border-bottom: 1px solid #e7eaf0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 35px;
                    position: sticky;
                    top: 0;
                    z-index: 50;
                }

                .sd-topbar-left {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .sd-breadcrumb {
                    display: block;
                    color: #8b95a7;
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-weight: 700;
                    margin-bottom: 3px;
                }

                .sd-topbar h1 {
                    margin: 0;
                    font-size: 20px;
                    line-height: 1.2;
                    font-weight: 750;
                    color: #172033;
                }

                .sd-online {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    color: #647087;
                    font-size: 12px;
                }

                .sd-online span {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #22c55e;
                    box-shadow: 0 0 0 4px rgba(34,197,94,.1);
                }

                .sd-menu-button,
                .sd-mobile-close {
                    display: none;
                }

                .sd-content {
                    width: 100%;
                    max-width: 1500px;
                    margin: 0 auto;
                    padding: 32px 35px 60px;
                }


                /* =================================================
                   WELCOME
                ================================================= */

                .sd-welcome {
                    min-height: 185px;
                    border-radius: 18px;
                    background: linear-gradient(
                        120deg,
                        #162235,
                        #202e45
                    );
                    color: #fff;
                    padding: 34px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    overflow: hidden;
                    position: relative;
                    margin-bottom: 22px;
                }

                .sd-welcome::after {
                    content: "";
                    position: absolute;
                    width: 300px;
                    height: 300px;
                    border-radius: 50%;
                    border: 1px solid rgba(255,255,255,.08);
                    right: -80px;
                    top: -100px;
                }

                .sd-welcome > div:first-child {
                    position: relative;
                    z-index: 2;
                }

                .sd-welcome span,
                .sd-page-heading > div > span,
                .sd-section-heading > div > span {
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 1.3px;
                    color: #f97316;
                }

                .sd-welcome h2 {
                    font-size: 29px;
                    margin: 8px 0 8px;
                    letter-spacing: -.7px;
                }

                .sd-welcome p {
                    margin: 0;
                    color: #aeb9c9;
                    font-size: 13px;
                    max-width: 610px;
                    line-height: 1.6;
                }

                .sd-welcome-icon {
                    width: 105px;
                    height: 105px;
                    border-radius: 28px;
                    display: grid;
                    place-items: center;
                    background: rgba(249,115,22,.12);
                    border: 1px solid rgba(249,115,22,.2);
                    color: #fb923c;
                    margin-right: 25px;
                    z-index: 2;
                }


                /* =================================================
                   STATISTICS
                ================================================= */

                .sd-stat-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin-bottom: 22px;
                }

                .sd-stat-card {
                    background: #fff;
                    border: 1px solid #e8ebf1;
                    border-radius: 14px;
                    min-height: 112px;
                    padding: 21px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .sd-stat-icon {
                    width: 46px;
                    height: 46px;
                    border-radius: 12px;
                    display: grid;
                    place-items: center;
                    background: #fff1e8;
                    color: #f97316;
                    flex-shrink: 0;
                }

                .sd-stat-success {
                    background: #eaf9f0;
                    color: #16a34a;
                }

                .sd-stat-danger {
                    background: #fff0f0;
                    color: #dc2626;
                }

                .sd-stat-purple {
                    background: #f2edff;
                    color: #7c3aed;
                }

                .sd-stat-card span {
                    display: block;
                    color: #7c8799;
                    font-size: 11px;
                    margin-bottom: 5px;
                }

                .sd-stat-card strong {
                    display: block;
                    color: #172033;
                    font-size: 24px;
                    font-weight: 750;
                }


                /* =================================================
                   CARDS
                ================================================= */

                .sd-section-card {
                    background: #fff;
                    border: 1px solid #e8ebf1;
                    border-radius: 15px;
                    padding: 24px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 7px rgba(20,30,50,.02);
                }

                .sd-section-heading {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .sd-section-heading h3 {
                    margin: 5px 0 0;
                    font-size: 17px;
                    color: #172033;
                }

                .sd-section-heading p {
                    margin: 5px 0 0;
                    color: #7d8798;
                    font-size: 12px;
                }


                /* =================================================
                   QUICK ACTIONS
                ================================================= */

                .sd-quick-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 14px;
                }

                .sd-quick-card {
                    border: 1px solid #e8ebf1;
                    background: #fff;
                    border-radius: 12px;
                    padding: 17px;
                    display: flex;
                    align-items: center;
                    gap: 13px;
                    text-align: left;
                    cursor: pointer;
                    transition: .2s ease;
                    color: #172033;
                }

                .sd-quick-card:hover {
                    border-color: #f97316;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(20,30,50,.06);
                }

                .sd-quick-card > svg {
                    margin-left: auto;
                    color: #a1a9b7;
                }

                .sd-quick-icon {
                    width: 43px;
                    height: 43px;
                    border-radius: 11px;
                    display: grid;
                    place-items: center;
                    background: #fff2e9;
                    color: #f97316;
                    flex-shrink: 0;
                }

                .sd-quick-card strong {
                    display: block;
                    font-size: 13px;
                }

                .sd-quick-card span {
                    display: block;
                    color: #7d8798;
                    font-size: 11px;
                    margin-top: 4px;
                    line-height: 1.45;
                }


                /* =================================================
                   MINI TABLE
                ================================================= */

                .sd-text-button {
                    border: 0;
                    background: transparent;
                    color: #f97316;
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 700;
                }

                .sd-mini-table {
                    border-top: 1px solid #eef0f4;
                }

                .sd-mini-row {
                    min-height: 65px;
                    border-bottom: 1px solid #eef0f4;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .sd-mini-row:last-child {
                    border-bottom: 0;
                }

                .sd-student-avatar {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    background: #fff1e8;
                    color: #f97316;
                    display: grid;
                    place-items: center;
                    font-size: 13px;
                    font-weight: 800;
                    flex-shrink: 0;
                }

                .sd-mini-student {
                    flex: 1;
                }

                .sd-mini-student strong {
                    display: block;
                    font-size: 12px;
                }

                .sd-mini-student span {
                    display: block;
                    margin-top: 3px;
                    color: #8992a2;
                    font-size: 10px;
                }


                /* =================================================
                   STATUS
                ================================================= */

                .sd-status {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    border-radius: 20px;
                    padding: 5px 9px;
                    font-size: 10px;
                    font-weight: 750;
                }

                .sd-status span {
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                }

                .sd-status-active {
                    background: #eaf9f0;
                    color: #16803b;
                }

                .sd-status-active span {
                    background: #22c55e;
                }

                .sd-status-inactive {
                    background: #fff0f0;
                    color: #c53030;
                }

                .sd-status-inactive span {
                    background: #ef4444;
                }


                /* =================================================
                   PAGE HEADING
                ================================================= */

                .sd-page-heading {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 20px;
                    margin-bottom: 25px;
                }

                .sd-page-heading h2 {
                    margin: 5px 0 5px;
                    font-size: 27px;
                    letter-spacing: -.5px;
                }

                .sd-page-heading p {
                    margin: 0;
                    color: #7d8798;
                    font-size: 13px;
                }


                /* =================================================
                   BUTTONS
                ================================================= */

                .sd-primary-button {
                    min-height: 42px;
                    padding: 0 16px;
                    border: 0;
                    border-radius: 9px;
                    background: #f97316;
                    color: #fff;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 750;
                    box-shadow: 0 5px 15px rgba(249,115,22,.18);
                    transition: .2s ease;
                }

                .sd-primary-button:hover {
                    background: #ea580c;
                    transform: translateY(-1px);
                }

                .sd-primary-button:disabled {
                    opacity: .6;
                    cursor: not-allowed;
                    transform: none;
                }

                .sd-refresh-button {
                    min-height: 38px;
                    padding: 0 12px;
                    border: 1px solid #e0e4eb;
                    border-radius: 8px;
                    background: #fff;
                    color: #556074;
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 700;
                }

                .sd-refresh-button:hover {
                    border-color: #cbd1db;
                    background: #f8f9fb;
                }

                .sd-form-button {
                    margin-top: 21px;
                    min-height: 43px;
                }


                /* =================================================
                   FORM
                ================================================= */

                .sd-student-form {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr auto;
                    gap: 14px;
                    align-items: end;
                }

                .sd-form-field label {
                    display: block;
                    color: #3b4558;
                    font-size: 11px;
                    font-weight: 700;
                    margin-bottom: 7px;
                }

                .sd-form-field input {
                    width: 100%;
                    min-height: 43px;
                    border: 1px solid #dfe3ea;
                    border-radius: 8px;
                    outline: none;
                    padding: 0 12px;
                    font-size: 12px;
                    color: #172033;
                    background: #fff;
                    transition: .2s ease;
                }

                .sd-form-field input:focus {
                    border-color: #f97316;
                    box-shadow: 0 0 0 3px rgba(249,115,22,.09);
                }

                .sd-form-field input::placeholder {
                    color: #a6adba;
                }


                /* =================================================
                   SEARCH
                ================================================= */

                .sd-student-list-heading {
                    margin-bottom: 16px;
                }

                .sd-student-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 18px;
                }

                .sd-search {
                    max-width: 350px;
                    width: 100%;
                    height: 40px;
                    border: 1px solid #dfe3ea;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0 11px;
                    color: #98a1b0;
                }

                .sd-search input {
                    border: 0;
                    outline: 0;
                    width: 100%;
                    font-size: 12px;
                    color: #172033;
                    background: transparent;
                }

                .sd-student-toolbar > span {
                    color: #8b94a4;
                    font-size: 11px;
                }


                /* =================================================
                   TABLE
                ================================================= */

                .sd-table-wrapper {
                    overflow-x: auto;
                    border: 1px solid #edf0f4;
                    border-radius: 10px;
                }

                .sd-table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 900px;
                }

                .sd-table th {
                    background: #f8f9fb;
                    color: #7a8495;
                    font-size: 9px;
                    text-transform: uppercase;
                    letter-spacing: .8px;
                    font-weight: 800;
                    text-align: left;
                    padding: 12px 15px;
                    border-bottom: 1px solid #e9edf2;
                }

                .sd-table td {
                    padding: 13px 15px;
                    border-bottom: 1px solid #eef0f4;
                    font-size: 11px;
                    color: #526074;
                }

                .sd-table tbody tr:last-child td {
                    border-bottom: 0;
                }

                .sd-table tbody tr:hover {
                    background: #fcfcfd;
                }

                .sd-table-student {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .sd-table-student strong {
                    display: block;
                    color: #20293a;
                    font-size: 11px;
                }

                .sd-table-student span {
                    display: block;
                    color: #9aa2b0;
                    font-size: 9px;
                    margin-top: 3px;
                }

                .sd-username {
                    color: #667185;
                }

                .sd-action-danger,
                .sd-action-success {
                    min-height: 34px;
                    padding: 0 10px;
                    border-radius: 7px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 750;
                    border: 1px solid transparent;
                }

                .sd-action-danger {
                    background: #fff3f3;
                    color: #dc2626;
                    border-color: #ffdcdc;
                }

                .sd-action-success {
                    background: #edf9f2;
                    color: #16803b;
                    border-color: #d2f1dc;
                }
                
                    
                .sd-action-delete {
                  min-height: 34px;
                  padding: 0 10px;
                  border-radius: 7px;
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  cursor: pointer;
                  font-size: 10px;
                  font-weight: 750;
                  border: 1px solid #ffdcdc;
                  background: #fff3f3;
                  color: #dc2626;
               }

                 .sd-action-delete:hover {
                   background: #fee2e2;
                 }

               .sd-action-delete:disabled {
                   opacity: .55;
                  cursor: not-allowed;
               }

                .sd-action-danger:hover {
                    background: #fee7e7;
                }

                .sd-action-success:hover {
                    background: #dcf7e5;
                }

                .sd-action-danger:disabled,
                .sd-action-success:disabled {
                    opacity: .55;
                    cursor: not-allowed;
                }


                /* =================================================
                   ALERTS
                ================================================= */

                .sd-alert {
                    min-height: 46px;
                    border-radius: 9px;
                    margin-bottom: 18px;
                    padding: 0 13px;
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    font-size: 12px;
                }

                .sd-alert button {
                    margin-left: auto;
                    border: 0;
                    background: transparent;
                    font-size: 18px;
                    cursor: pointer;
                    color: inherit;
                }

                .sd-alert-error {
                    color: #b42318;
                    background: #fff0ee;
                    border: 1px solid #ffd6d1;
                }

                .sd-alert-success {
                    color: #16733a;
                    background: #edf9f1;
                    border: 1px solid #d1f0db;
                }


                /* =================================================
                   EMPTY / LOADING
                ================================================= */

                .sd-loading {
                    min-height: 150px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 9px;
                    color: #788395;
                    font-size: 12px;
                }

                .sd-empty {
                    min-height: 170px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    color: #9aa2b0;
                    gap: 7px;
                }

                .sd-empty strong {
                    color: #495469;
                    font-size: 13px;
                }

                .sd-empty span {
                    font-size: 11px;
                }

                .sd-empty-large {
                    min-height: 350px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 40px;
                }

                .sd-large-icon {
                    width: 75px;
                    height: 75px;
                    border-radius: 20px;
                    display: grid;
                    place-items: center;
                    background: #fff1e8;
                    color: #f97316;
                    margin-bottom: 17px;
                }

                .sd-empty-large h3 {
                    margin: 0;
                    font-size: 18px;
                }

                .sd-empty-large p {
                    max-width: 480px;
                    color: #7c8798;
                    font-size: 12px;
                    line-height: 1.6;
                    margin: 8px 0 20px;
                }


                /* =================================================
                   SATELLITE
                ================================================= */

                .sd-satellite-container {
                    width: 100%;
                    background: #fff;
                    border: 1px solid #e8ebf1;
                    border-radius: 15px;
                    padding: 5px;
                    overflow: hidden;
                }


                /* =================================================
                   SPIN
                ================================================= */

                .sd-spin {
                    animation: sdSpin 1s linear infinite;
                }

                @keyframes sdSpin {
                    to {
                        transform: rotate(360deg);
                    }
                }


                /* =================================================
                   MOBILE
                ================================================= */

                @media (max-width: 1100px) {

                    .sd-stat-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .sd-student-form {
                        grid-template-columns: 1fr 1fr;
                    }

                    .sd-form-button {
                        margin-top: 0;
                    }

                }


                @media (max-width: 800px) {

                    .sd-sidebar {
                        position: fixed;
                        left: 0;
                        top: 0;
                        bottom: 0;
                        transform: translateX(-100%);
                        transition: transform .25s ease;
                        box-shadow: 10px 0 40px rgba(0,0,0,.2);
                    }

                    .sd-sidebar-open {
                        transform: translateX(0);
                    }

                    .sd-sidebar-overlay {
                        display: block;
                        position: fixed;
                        inset: 0;
                        border: 0;
                        background: rgba(10,18,30,.5);
                        z-index: 90;
                    }

                    .sd-mobile-close {
                        display: grid;
                        place-items: center;
                        margin-left: auto;
                        border: 0;
                        background: transparent;
                        color: #8d99ac;
                        cursor: pointer;
                    }

                    .sd-menu-button {
                        display: grid;
                        place-items: center;
                        width: 38px;
                        height: 38px;
                        border: 1px solid #e3e6ec;
                        border-radius: 8px;
                        background: #fff;
                        color: #4c576b;
                        cursor: pointer;
                    }

                    .sd-content {
                        padding: 24px 20px 50px;
                    }

                    .sd-topbar {
                        padding: 0 20px;
                    }

                    .sd-topbar-right {
                        display: none;
                    }

                    .sd-welcome-icon {
                        display: none;
                    }

                }


                @media (max-width: 600px) {

                    .sd-stat-grid {
                        grid-template-columns: 1fr;
                    }

                    .sd-quick-grid {
                        grid-template-columns: 1fr;
                    }

                    .sd-student-form {
                        grid-template-columns: 1fr;
                    }

                    .sd-form-button {
                        margin-top: 3px;
                    }

                    .sd-page-heading {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .sd-page-heading .sd-primary-button {
                        width: 100%;
                    }

                    .sd-section-card {
                        padding: 17px;
                    }

                    .sd-welcome {
                        padding: 25px;
                    }

                    .sd-welcome h2 {
                        font-size: 23px;
                    }

                    .sd-student-toolbar {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .sd-search {
                        max-width: none;
                    }

                    .sd-topbar {
                        height: 72px;
                    }

                    .sd-topbar h1 {
                        font-size: 17px;
                    }

                    .sd-breadcrumb {
                        font-size: 8px;
                    }

                }

            `}</style>

        </div>
    );
}