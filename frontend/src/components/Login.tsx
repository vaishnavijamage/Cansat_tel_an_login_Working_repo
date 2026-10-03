import { useState } from "react";
import {
    Link,
    useLocation,
    useNavigate,
    useSearchParams,
} from "react-router-dom";

import {
    loginSchool,
    loginStudent,
    getCurrentUser,
} from "../services/api";

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    /*
     * Determine login type from URL.
     *
     * /login and /login/school → School Login
     * /login/student           → Student Login
     */
    const type =
        location.pathname === "/login/student" ||
        (location.pathname !== "/login/school" &&
            searchParams.get("type") === "student")
            ? "student"
            : "school";

    const isStudent = type === "student";

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();

        setError("");

        const cleanIdentifier =
            identifier.trim();

        /*
         * Required fields
         */
        if (!cleanIdentifier || !password) {
            setError(
                isStudent
                    ? "Please enter your username and password."
                    : "Please enter your email and password."
            );
            return;
        }

        /*
         * School email validation
         */
        if (!isStudent) {
            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(cleanIdentifier)) {
                setError(
                    "Please enter a valid school email address."
                );
                return;
            }
        }

        /*
         * Student username validation
         */
        if (isStudent) {
            const usernamePattern =
                /^[a-z0-9_.]{4,50}$/;

            if (
                !usernamePattern.test(
                    cleanIdentifier.toLowerCase()
                )
            ) {
                setError(
                    "Please enter a valid username."
                );
                return;
            }
        }

        /*
         * Password validation
         */
        if (password.length > 128) {
            setError("Invalid password.");
            return;
        }

        if (/\s/.test(password)) {
            setError(
                "Password must not contain spaces."
            );
            return;
        }

        try {
            setIsLoading(true);

            let response;

            /*
             * Student login
             */
            if (isStudent) {
                response = await loginStudent({
                    username:
                        cleanIdentifier.toLowerCase(),
                    password,
                });
            }

            /*
             * School login
             */
            else {
                response = await loginSchool({
                    email:
                        cleanIdentifier.toLowerCase(),
                    password,
                });
            }

            console.log(
                "Login successful:",
                response
            );

            /*
             * Verify that the session cookie
             * was created correctly.
             */
            const currentUser =
                await getCurrentUser();

            console.log(
                "Current authenticated user:",
                currentUser
            );

            /*
             * Redirect based on account type.
             *
             * For now both dashboards can remain
             * protected separately.
             */
            if (isStudent) {
                navigate("/student");
            } else {
                navigate("/school");
            }
        } catch (error) {
            console.error(
                "Login error:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to login. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="login-page">
            <div className="login-container">

                {/* Header */}
                <div className="login-header">
                    <h1>
                        {isStudent
                            ? "Student Login"
                            : "School Login"}
                    </h1>

                    <p>
                        {isStudent
                            ? "Sign in to access your student account"
                            : "Sign in to manage your school account"}
                    </p>
                </div>

                {/* Login Form */}
                <form
                    onSubmit={handleSubmit}
                    className="login-form"
                    noValidate
                >

                    {/* Email / Username */}
                    <div className="form-field">
                        <label htmlFor="identifier">
                            {isStudent
                                ? "Username"
                                : "School Email"}
                        </label>

                        <input
                            id="identifier"
                            type={
                                isStudent
                                    ? "text"
                                    : "email"
                            }
                            placeholder={
                                isStudent
                                    ? "Enter your username"
                                    : "Enter your school email"
                            }
                            value={identifier}
                            onChange={(e) =>
                                setIdentifier(
                                    e.target.value
                                )
                            }
                            autoComplete={
                                isStudent
                                    ? "username"
                                    : "email"
                            }
                            maxLength={255}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    {/* Password */}
                    <div className="form-field">
                        <label htmlFor="password">
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) =>
                                setPassword(
                                    e.target.value
                                )
                            }
                            autoComplete="current-password"
                            maxLength={128}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    {/* Forgot Password - School Only */}
                    {!isStudent && (
                        <div className="forgot-password-link">
                            <Link to="/forgot-password">
                                Forgot Password?
                            </Link>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <p
                            className="form-error"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}

                    {/* Login Button */}
                    <button
                        type="submit"
                        className="login-button"
                        disabled={isLoading}
                    >
                        {isLoading
                            ? "Signing in..."
                            : "Login"}
                    </button>
                </form>

                {/* School Registration */}
                {!isStudent && (
                    <p className="register-link">
                        Don't have a school account?{" "}
                        <Link to="/register">
                            Register your school
                        </Link>
                    </p>
                )}

                {/* Switch Login Type */}
                <p className="register-link">
                    {isStudent ? (
                        <>
                            Are you a school?{" "}
                            <Link to="/login/school">
                                School Login
                            </Link>
                        </>
                    ) : (
                        <>
                            Are you a student?{" "}
                            <Link to="/login/student">
                                Student Login
                            </Link>
                        </>
                    )}
                </p>

            </div>
        </main>
    );
}