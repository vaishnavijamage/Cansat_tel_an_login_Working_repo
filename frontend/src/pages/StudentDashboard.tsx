import { useEffect, useState } from "react";
import {
    Activity,
    KeyRound,
    LogOut,
    ShieldCheck,
    UserRound,
} from "lucide-react";

import StudentSatelliteDashboard from "./StudentSatelliteDashboard";

import {
    getStudentProfile,
    logout,
} from "../services/api";


/* =========================================================
   TYPES
========================================================= */

type StudentProfile = {
    id: number;
    schoolId: number;
    studentName: string;
    username: string;
    isActive: boolean | number;
};


/* =========================================================
   MAIN STUDENT DASHBOARD
========================================================= */

export default function StudentDashboard() {

    /* =====================================================
       ACCOUNT MENU
    ===================================================== */

    const [showAccount, setShowAccount] =
        useState(false);


    /* =====================================================
       STUDENT PROFILE
    ===================================================== */

    const [student, setStudent] =
        useState<StudentProfile | null>(null);

    const [isLoadingStudent, setIsLoadingStudent] =
        useState(true);


    /* =====================================================
       LOAD LOGGED-IN STUDENT
       
       IMPORTANT:
       The student's name is NOT taken from localStorage.

       The backend identifies the logged-in student using
       the HTTP-only session_token cookie.

       getStudentProfile() sends the request using that
       authenticated session and returns the student profile.
    ===================================================== */

    useEffect(() => {

        const loadStudentProfile = async () => {

            try {

                setIsLoadingStudent(true);

                const response =
                    await getStudentProfile();

                console.log(
                    "Student profile:",
                    response.student
                );

                setStudent(
                    response.student
                );

            } catch (error) {

                console.error(
                    "Unable to load student profile:",
                    error
                );

                setStudent(null);

            } finally {

                setIsLoadingStudent(false);

            }
        };


        loadStudentProfile();

    }, []);


    /* =====================================================
       STUDENT NAME

       This now comes from the backend profile.

       NOT from localStorage.
    ===================================================== */

    const studentName =
        isLoadingStudent
            ? "Student"
            : student?.studentName?.trim() || "Student";


    /* =====================================================
       LOGOUT
    ===================================================== */

    const handleLogout = async () => {

        try {

            /*
             * Use the existing backend logout function.
             *
             * This properly invalidates the session_token
             * cookie/session on the backend.
             */

            await logout();

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

        } finally {

            /*
             * Redirect to login regardless of whether
             * the logout request succeeds.
             */

            window.location.href = "/login";

        }
    };


    /* =====================================================
       RESET PASSWORD
    ===================================================== */

    const handleResetPassword = () => {

        setShowAccount(false);

        window.location.href =
            "/reset-password";
    };


    /* =====================================================
       RENDER
    ===================================================== */

    return (

        <div className="student-dashboard-page">

            {/* =================================================
                PAGE STYLES
            ================================================= */}

            <style>{`

                * {
                    box-sizing: border-box;
                }


                .student-dashboard-page {
                    min-height: 100vh;

                    background: #f7f8fb;

                    color: #111827;

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
                   HEADER
                ================================================= */

                .student-top-header {
                    width: 100%;
                    height: 76px;

                    background:
                        rgba(255, 255, 255, 0.96);

                    border-bottom:
                        1px solid #e5e7eb;

                    display: flex;
                    align-items: center;
                    justify-content: space-between;

                    padding: 0 5%;

                    position: sticky;
                    top: 0;

                    z-index: 1000;

                    backdrop-filter:
                        blur(12px);
                }


                .student-brand {
                    display: flex;
                    align-items: center;

                    gap: 13px;
                }


                .student-brand-icon {
                    width: 42px;
                    height: 42px;

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    background: #fff7ed;

                    color: #f97316;

                    border:
                        1px solid #fed7aa;

                    border-radius: 12px;
                }


                .student-brand-title {
                    font-size: 17px;
                    font-weight: 700;

                    color: #111827;

                    line-height: 1.2;
                }


                .student-brand-subtitle {
                    margin-top: 3px;

                    font-size: 12px;
                    font-weight: 500;

                    letter-spacing: 0.04em;

                    color: #8b95a7;
                }


                .student-header-actions {
                    display: flex;
                    align-items: center;

                    gap: 10px;

                    position: relative;
                }


                .account-button,
                .logout-button {
                    height: 40px;

                    display: inline-flex;
                    align-items: center;
                    justify-content: center;

                    gap: 8px;

                    padding: 0 15px;

                    border-radius: 9px;

                    font-size: 14px;
                    font-weight: 600;

                    cursor: pointer;

                    transition:
                        background 0.2s ease,
                        border-color 0.2s ease,
                        transform 0.2s ease;
                }


                .account-button {
                    background: #ffffff;

                    border:
                        1px solid #dfe3ea;

                    color: #374151;
                }


                .account-button:hover {
                    background: #f9fafb;

                    border-color:
                        #cfd5df;
                }


                .logout-button {
                    background: #ffffff;

                    border:
                        1px solid #fecaca;

                    color: #dc2626;
                }


                .logout-button:hover {
                    background: #fff5f5;

                    border-color:
                        #fca5a5;
                }


                /* =================================================
                   ACCOUNT MENU
                ================================================= */

                .account-menu {
                    position: absolute;

                    top: 50px;
                    right: 88px;

                    width: 250px;

                    background: #ffffff;

                    border:
                        1px solid #e5e7eb;

                    border-radius: 12px;

                    box-shadow:
                        0 14px 35px
                        rgba(15, 23, 42, 0.10);

                    padding: 8px;

                    z-index: 2000;
                }


                .account-menu-user {
                    padding: 12px;

                    border-bottom:
                        1px solid #f0f1f3;

                    margin-bottom: 5px;
                }


                .account-menu-user-label {
                    font-size: 11px;
                    font-weight: 600;

                    text-transform: uppercase;

                    letter-spacing: 0.08em;

                    color: #9ca3af;
                }


                .account-menu-user-name {
                    margin-top: 4px;

                    font-size: 14px;
                    font-weight: 700;

                    color: #111827;

                    word-break: break-word;
                }


                .account-menu-item {
                    width: 100%;

                    border: none;

                    background: transparent;

                    display: flex;
                    align-items: center;

                    gap: 10px;

                    padding: 11px 12px;

                    border-radius: 8px;

                    font-size: 14px;
                    font-weight: 600;

                    color: #374151;

                    cursor: pointer;

                    text-align: left;
                }


                .account-menu-item:hover {
                    background: #f8fafc;
                }


                .account-menu-item svg {
                    color: #6b7280;
                }


                /* =================================================
                   MAIN CONTENT
                ================================================= */

                .student-dashboard-content {
                    width: min(1400px, 90%);

                    margin: 0 auto;

                    padding: 42px 0 0;
                }


                /* =================================================
                   WELCOME SECTION
                ================================================= */

                .student-welcome {
                    background: #ffffff;

                    border:
                        1px solid #e5e7eb;

                    border-radius: 16px;

                    padding: 32px 36px;

                    display: flex;
                    align-items: center;
                    justify-content: space-between;

                    gap: 30px;

                    margin-bottom: 28px;
                }


                .student-welcome-left {
                    min-width: 0;
                }


                .student-eyebrow {
                    display: flex;
                    align-items: center;

                    gap: 9px;

                    margin-bottom: 10px;

                    font-size: 12px;
                    font-weight: 700;

                    text-transform: uppercase;

                    letter-spacing: 0.14em;

                    color: #f97316;
                }


                .student-eyebrow-line {
                    width: 25px;
                    height: 2px;

                    background: #f97316;

                    border-radius: 999px;
                }


                .student-welcome h1 {
                    margin: 0;

                    font-size:
                        clamp(30px, 4vw, 44px);

                    line-height: 1.12;

                    font-weight: 750;

                    letter-spacing: -0.035em;

                    color: #111827;
                }


                .student-welcome-name {
                    color: #f97316;

                    word-break: break-word;
                }


                .student-welcome-description {
                    margin: 12px 0 0;

                    max-width: 760px;

                    font-size: 15px;

                    line-height: 1.7;

                    color: #64748b;
                }


                .student-access {
                    flex-shrink: 0;

                    display: inline-flex;
                    align-items: center;

                    gap: 8px;

                    padding: 10px 14px;

                    border-radius: 999px;

                    background: #f0fdf4;

                    border:
                        1px solid #bbf7d0;

                    color: #15803d;

                    font-size: 13px;
                    font-weight: 650;
                }


                /* =================================================
                   SATELLITE AREA
                ================================================= */

                .student-satellite-area {
                    margin-top: 0;
                }


                /* =================================================
                   BOTTOM INFORMATION
                ================================================= */

                .student-access-information {
                    margin-top: 38px;

                    border-top:
                        1px solid #e2e6ec;

                    border-bottom:
                        1px solid #e2e6ec;

                    padding: 24px 4px;

                    display: flex;
                    align-items: center;
                    justify-content: space-between;

                    gap: 30px;
                }


                .student-access-left {
                    display: flex;
                    align-items: flex-start;

                    gap: 12px;
                }


                .student-access-icon {
                    width: 34px;
                    height: 34px;

                    flex-shrink: 0;

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    color: #2563eb;
                }


                .student-access-title {
                    font-size: 14px;
                    font-weight: 700;

                    color: #334155;

                    margin-bottom: 4px;
                }


                .student-access-text {
                    margin: 0;

                    font-size: 13px;

                    line-height: 1.6;

                    color: #718096;
                }


                .student-access-right {
                    flex-shrink: 0;

                    font-size: 12px;
                    font-weight: 600;

                    color: #94a3b8;
                }


                /* =================================================
                   FOOTER
                ================================================= */

                .student-footer {
                    width: min(1400px, 90%);

                    margin: 0 auto;

                    padding: 20px 0 28px;

                    display: flex;
                    align-items: center;
                    justify-content: space-between;

                    gap: 20px;

                    font-size: 12px;

                    color: #94a3b8;
                }


                .student-footer-brand {
                    font-weight: 600;

                    color: #64748b;
                }


                .student-footer-status {
                    display: flex;
                    align-items: center;

                    gap: 7px;
                }


                .student-footer-dot {
                    width: 6px;
                    height: 6px;

                    border-radius: 50%;

                    background: #22c55e;
                }


                /* =================================================
                   MOBILE
                ================================================= */

                @media (max-width: 768px) {

                    .student-top-header {
                        height: 68px;

                        padding: 0 18px;
                    }


                    .student-brand-icon {
                        width: 38px;
                        height: 38px;
                    }


                    .student-brand-title {
                        font-size: 15px;
                    }


                    .student-brand-subtitle {
                        font-size: 10px;
                    }


                    .account-button span,
                    .logout-button span {
                        display: none;
                    }


                    .account-button,
                    .logout-button {
                        width: 40px;

                        padding: 0;
                    }


                    .account-menu {
                        right: 45px;
                    }


                    .student-dashboard-content {
                        width:
                            calc(100% - 28px);

                        padding-top: 22px;
                    }


                    .student-welcome {
                        padding: 25px 22px;

                        flex-direction: column;

                        align-items: flex-start;

                        border-radius: 13px;

                        margin-bottom: 20px;
                    }


                    .student-welcome h1 {
                        font-size: 32px;
                    }


                    .student-welcome-description {
                        font-size: 14px;
                    }


                    .student-access {
                        font-size: 12px;
                    }


                    .student-access-information {
                        flex-direction: column;

                        align-items: flex-start;

                        gap: 14px;

                        padding: 20px 0;
                    }


                    .student-access-right {
                        padding-left: 46px;
                    }


                    .student-footer {
                        width:
                            calc(100% - 28px);

                        flex-direction: column;

                        align-items: flex-start;

                        padding-bottom: 22px;
                    }
                }


                @media (max-width: 480px) {

                    .student-brand-subtitle {
                        display: none;
                    }


                    .student-welcome h1 {
                        font-size: 28px;
                    }


                    .student-welcome {
                        padding: 22px 18px;
                    }


                    .student-access {
                        align-self: flex-start;
                    }
                }

            `}</style>


            {/* =====================================================
                TOP HEADER
            ===================================================== */}

            <header className="student-top-header">

                <div className="student-brand">

                    <div className="student-brand-icon">
                        <Activity size={21} />
                    </div>


                    <div>

                        <div className="student-brand-title">
                            Student Dashboard
                        </div>


                        <div className="student-brand-subtitle">
                            SPACE EDUCATION PLATFORM
                        </div>

                    </div>

                </div>


                <div className="student-header-actions">

                    {/* ACCOUNT */}

                    <button
                        type="button"
                        className="account-button"
                        onClick={() =>
                            setShowAccount(
                                !showAccount
                            )
                        }
                    >

                        <UserRound size={17} />

                        <span>
                            Account
                        </span>

                    </button>


                    {/* LOGOUT */}

                    <button
                        type="button"
                        className="logout-button"
                        onClick={handleLogout}
                    >

                        <LogOut size={17} />

                        <span>
                            Logout
                        </span>

                    </button>


                    {/* =================================================
                        ACCOUNT MENU
                    ================================================= */}

                    {showAccount && (

                        <div className="account-menu">

                            <div className="account-menu-user">

                                <div className="account-menu-user-label">
                                    Signed in as
                                </div>


                                <div className="account-menu-user-name">

                                    {isLoadingStudent
                                        ? "Loading..."
                                        : studentName}

                                </div>

                            </div>


                            <button
                                type="button"
                                className="account-menu-item"
                                onClick={
                                    handleResetPassword
                                }
                            >

                                <KeyRound size={16} />

                                Reset Password

                            </button>

                        </div>

                    )}

                </div>

            </header>


            {/* =====================================================
                MAIN
            ===================================================== */}

            <main className="student-dashboard-content">


                {/* =================================================
                    WELCOME
                ================================================= */}

                <section className="student-welcome">

                    <div className="student-welcome-left">

                        <div className="student-eyebrow">

                            <span className="student-eyebrow-line" />

                            STUDENT PORTAL

                        </div>


                        <h1>

                            Welcome back,{" "}

                            <span className="student-welcome-name">

                                {isLoadingStudent
                                    ? "Student"
                                    : studentName}

                            </span>

                            {" "}👋

                        </h1>


                        <p className="student-welcome-description">

                            Monitor your assigned satellite
                            telemetry, explore mission data,
                            and track your spacecraft activity
                            from your student portal.

                        </p>

                    </div>


                    <div className="student-access">

                        <ShieldCheck size={16} />

                        View-only access

                    </div>

                </section>


                {/* =================================================
                    EXISTING SATELLITE DASHBOARD
                ================================================= */}

                <section className="student-satellite-area">

                    <StudentSatelliteDashboard />

                </section>


                {/* =================================================
                    ACCESS INFORMATION
                ================================================= */}

                <section className="student-access-information">

                    <div className="student-access-left">

                        <div className="student-access-icon">

                            <ShieldCheck size={22} />

                        </div>


                        <div>

                            <div className="student-access-title">

                                View-only student access

                            </div>


                            <p className="student-access-text">

                                You can view, filter and export
                                your assigned satellite data.
                                Student accounts cannot modify
                                satellite telemetry or other
                                student accounts.

                            </p>

                        </div>

                    </div>


                    <div className="student-access-right">

                        Secure student portal

                    </div>

                </section>

            </main>


            {/* =====================================================
                FOOTER
            ===================================================== */}




        </div>
    );
}