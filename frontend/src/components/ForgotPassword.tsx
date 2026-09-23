import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/api";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();

        setMessage("");
        setError("");

        const cleanEmail = email.trim().toLowerCase();

        if (!cleanEmail) {
            setError("Please enter your school email.");
            return;
        }

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(cleanEmail)) {
            setError("Please enter a valid email address.");
            return;
        }

        try {
            setIsLoading(true);

            const response = await forgotPassword({
                email: cleanEmail,
            });

            setMessage(
                response.message ||
                "If the account exists, password recovery instructions have been provided."
            );

            setEmail("");
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to process password recovery."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="login-page">
            <div className="login-container">

                <div className="login-header">
                    <h1>Forgot Password</h1>

                    <p>
                        Enter your registered school email
                        to start password recovery.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="login-form"
                    noValidate
                >
                    <div className="form-field">
                        <label htmlFor="email">
                            School Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            placeholder="Enter your school email"
                            value={email}
                            onChange={(e) =>
                                setEmail(e.target.value)
                            }
                            autoComplete="email"
                            maxLength={150}
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
                            ? "Processing..."
                            : "Recover Password"}
                    </button>
                </form>

                <p className="register-link">
                    Remember your password?{" "}
                    <Link to="/login">
                        Back to Login
                    </Link>
                </p>

            </div>
        </main>
    );
}