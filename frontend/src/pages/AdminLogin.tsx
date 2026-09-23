import { useState } from "react";
import type { FormEvent } from "react";

const API_BASE_URL = "http://localhost:5000";

export default function AdminLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError("");

        const cleanUsername =
            username.trim().toLowerCase();

        if (!cleanUsername || !password) {
            setError(
                "Username and password are required."
            );
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/auth/admin/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        username: cleanUsername,
                        password,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Invalid username or password."
                );
            }

            window.location.href = "/admin";

        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to login."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <style>{`
                * {
                    box-sizing: border-box;
                }

                .admin-login-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background: #f5f3ee;
                    font-family: Arial, sans-serif;
                }

                .admin-login-card {
                    width: 100%;
                    max-width: 420px;
                    background: #ffffff;
                    padding: 40px;
                    border: 1px solid #e5e2db;
                    border-radius: 14px;
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
                }

                .admin-login-title {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 600;
                    color: #172033;
                }

                .admin-login-subtitle {
                    margin: 10px 0 30px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #667085;
                }

                .admin-login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .admin-field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .admin-field label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #344054;
                }

                .admin-field input {
                    width: 100%;
                    height: 46px;
                    padding: 0 14px;
                    border: 1px solid #d0d5dd;
                    border-radius: 8px;
                    outline: none;
                    font-size: 15px;
                    color: #101828;
                    background: #ffffff;
                    transition: border-color 0.2s,
                                box-shadow 0.2s;
                }

                .admin-field input:focus {
                    border-color: #344054;
                    box-shadow: 0 0 0 3px rgba(52, 64, 84, 0.08);
                }

                .admin-field input:disabled {
                    background: #f2f4f7;
                    cursor: not-allowed;
                }

                .admin-error {
                    padding: 12px 14px;
                    border: 1px solid #fecdca;
                    border-radius: 8px;
                    background: #fef3f2;
                    color: #b42318;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .admin-login-button {
                    width: 100%;
                    height: 46px;
                    border: none;
                    border-radius: 8px;
                    background: #172033;
                    color: #ffffff;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s,
                                opacity 0.2s;
                }

                .admin-login-button:hover {
                    background: #101828;
                }

                .admin-login-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                @media (max-width: 480px) {
                    .admin-login-page {
                        padding: 16px;
                    }

                    .admin-login-card {
                        padding: 28px 22px;
                    }

                    .admin-login-title {
                        font-size: 24px;
                    }
                }
            `}</style>

            <main className="admin-login-page">
                <section className="admin-login-card">
                    <h1 className="admin-login-title">
                        Admin Login
                    </h1>

                    <p className="admin-login-subtitle">
                        Sign in to access the administration panel.
                    </p>

                    <form
                        className="admin-login-form"
                        onSubmit={handleSubmit}
                    >
                        <div className="admin-field">
                            <label htmlFor="admin-username">
                                Username
                            </label>

                            <input
                                id="admin-username"
                                name="adminUsername"
                                type="text"
                                value={username}
                                onChange={(event) =>
                                    setUsername(
                                        event.target.value
                                    )
                                }
                                autoComplete="off"
                                disabled={loading}
                                placeholder="Enter admin username"
                            />
                        </div>

                        <div className="admin-field">
                            <label htmlFor="admin-password">
                                Password
                            </label>

                            <input
                                id="admin-password"
                                name="adminPassword"
                                type="password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(
                                        event.target.value
                                    )
                                }
                                autoComplete="new-password"
                                disabled={loading}
                                placeholder="Enter admin password"
                            />
                        </div>

                        {error && (
                            <div
                                className="admin-error"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="admin-login-button"
                            disabled={loading}
                        >
                            {loading
                                ? "Signing in..."
                                : "Sign In"}
                        </button>
                    </form>
                </section>
            </main>
        </>
    );
}