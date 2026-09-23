import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/api";

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const token = searchParams.get("token") || "";

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();

        setError("");
        setMessage("");

        if (!token) {
            setError("Invalid or missing password reset token.");
            return;
        }

        if (!password || !confirmPassword) {
            setError("Please fill in all fields.");
            return;
        }

        if (password.length < 8 || password.length > 128) {
            setError(
                "Password must be between 8 and 128 characters."
            );
            return;
        }

        if (/\s/.test(password)) {
            setError("Password must not contain spaces.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            setIsLoading(true);

            const response = await resetPassword({
                token,
                newPassword: password,
            });

            setMessage(
                response.message ||
                "Password reset successfully."
            );

            setPassword("");
            setConfirmPassword("");

            setTimeout(() => {
                navigate("/login");
            }, 1500);

        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to reset password."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="login-page">
            <div className="login-container">

                <div className="login-header">
                    <h1>Reset Password</h1>

                    <p>
                        Create a new password for your account.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="login-form"
                    noValidate
                >
                    <div className="form-field">
                        <label htmlFor="password">
                            New Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) =>
                                setPassword(e.target.value)
                            }
                            autoComplete="new-password"
                            maxLength={128}
                            required
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="confirmPassword">
                            Confirm Password
                        </label>

                        <input
                            id="confirmPassword"
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) =>
                                setConfirmPassword(
                                    e.target.value
                                )
                            }
                            autoComplete="new-password"
                            maxLength={128}
                            required
                        />
                    </div>

                    {error && (
                        <p
                            className="form-error"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}

                    {message && (
                        <p className="form-success">
                            {message}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="login-button"
                        disabled={isLoading}
                    >
                        {isLoading
                            ? "Resetting..."
                            : "Reset Password"}
                    </button>
                </form>

                <p className="register-link">
                    <Link to="/login">
                        Back to Login
                    </Link>
                </p>

            </div>
        </main>
    );
}