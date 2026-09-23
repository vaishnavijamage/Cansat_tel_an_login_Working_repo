import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerSchool } from "../services/api";

export default function Register() {
    const navigate = useNavigate();

    const [schoolName, setSchoolName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();

        setError("");
        setSuccess("");

        const cleanSchoolName = schoolName.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        // Required fields
        if (
            !cleanSchoolName ||
            !cleanEmail ||
            !cleanPhone ||
            !password ||
            !confirmPassword
        ) {
            setError("Please fill in all fields.");
            return;
        }

        // School name validation
        if (
            cleanSchoolName.length < 2 ||
            cleanSchoolName.length > 150
        ) {
            setError(
                "School name must be between 2 and 150 characters."
            );
            return;
        }

        if (/\s{2,}/.test(cleanSchoolName)) {
            setError(
                "School name contains invalid spacing."
            );
            return;
        }

        // Email validation
        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(cleanEmail)) {
            setError(
                "Please enter a valid email address."
            );
            return;
        }

        // Phone validation
        if (!/^\d{10}$/.test(cleanPhone)) {
            setError(
                "Please enter a valid 10-digit phone number."
            );
            return;
        }

        // Password validation
        if (password.length < 8 || password.length > 128) {
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

        if (!/[A-Z]/.test(password)) {
            setError(
                "Password must contain at least one uppercase letter."
            );
            return;
        }

        if (!/[a-z]/.test(password)) {
            setError(
                "Password must contain at least one lowercase letter."
            );
            return;
        }

        if (!/[0-9]/.test(password)) {
            setError(
                "Password must contain at least one number."
            );
            return;
        }

        if (!/[!@#$%^&*]/.test(password)) {
            setError(
                "Password must contain at least one special character."
            );
            return;
        }

        // Confirm password
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            setIsLoading(true);

            // Send registration request to backend
            const response = await registerSchool({
                schoolName: cleanSchoolName,
                email: cleanEmail,
                phone: cleanPhone,
                password,
            });

            console.log(
                "School registration response:",
                response
            );

            setSuccess(
                "School account created successfully. Redirecting to login..."
            );

            // Clear password fields
            setPassword("");
            setConfirmPassword("");

            // Redirect to login after short delay
            setTimeout(() => {
                navigate("/login?type=school");
            }, 1200);

        } catch (error) {
            console.error(
                "School registration error:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to create school account. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="login-page">
            <div className="login-container">

                <div className="login-header">
                    <h1>Register School</h1>

                    <p>
                        Create an account for your school
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="login-form"
                    noValidate
                >

                    {/* School Name */}
                    <div className="form-field">
                        <label htmlFor="schoolName">
                            School Name
                        </label>

                        <input
                            id="schoolName"
                            type="text"
                            placeholder="Enter school name"
                            value={schoolName}
                            onChange={(e) =>
                                setSchoolName(e.target.value)
                            }
                            autoComplete="organization"
                            maxLength={150}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    {/* Email */}
                    <div className="form-field">
                        <label htmlFor="email">
                            School Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            placeholder="Enter official school email"
                            value={email}
                            onChange={(e) =>
                                setEmail(e.target.value)
                            }
                            autoComplete="email"
                            maxLength={255}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    {/* Phone */}
                    <div className="form-field">
                        <label htmlFor="phone">
                            Phone Number
                        </label>

                        <input
                            id="phone"
                            type="tel"
                            placeholder="Enter 10-digit phone number"
                            value={phone}
                            onChange={(e) =>
                                setPhone(
                                    e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 10)
                                )
                            }
                            autoComplete="tel"
                            inputMode="numeric"
                            maxLength={10}
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
                            placeholder="Create a password"
                            value={password}
                            onChange={(e) =>
                                setPassword(e.target.value)
                            }
                            autoComplete="new-password"
                            maxLength={128}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    {/* Confirm Password */}
                    <div className="form-field">
                        <label htmlFor="confirmPassword">
                            Confirm Password
                        </label>

                        <input
                            id="confirmPassword"
                            type="password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) =>
                                setConfirmPassword(
                                    e.target.value
                                )
                            }
                            autoComplete="new-password"
                            maxLength={128}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <p
                            className="form-error"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}

                    {/* Success */}
                    {success && (
                        <p
                            className="form-success"
                            role="status"
                        >
                            {success}
                        </p>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        className="login-button"
                        disabled={isLoading}
                    >
                        {isLoading
                            ? "Creating Account..."
                            : "Create Account"}
                    </button>
                </form>

                <p className="register-link">
                    Already have an account?{" "}

                    <Link to="/login?type=school">
                        Login
                    </Link>
                </p>

            </div>
        </main>
    );
}