import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function VerifyOTP() {
    const navigate = useNavigate();

    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");

        const cleanOTP = otp.trim();

        if (!cleanOTP) {
            setError("Please enter the OTP.");
            return;
        }

        if (!/^\d{6}$/.test(cleanOTP)) {
            setError("OTP must contain exactly 6 digits.");
            return;
        }

        try {
            setIsLoading(true);

            // Temporary frontend testing only.
            console.log("OTP:", cleanOTP);

            setTimeout(() => {
                navigate("/dashboard");
            }, 500);
        } catch {
            setError("Unable to verify OTP. Please try again.");
            setIsLoading(false);
        }
    };

    const handleOTPChange = (value: string) => {
        // Allow numbers only and limit to 6 digits
        const numbersOnly = value.replace(/\D/g, "").slice(0, 6);

        setOtp(numbersOnly);
        setError("");
    };

    return (
        <main className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <h1>Verify OTP</h1>
                    <p>Enter the 6-digit code sent to your registered email.</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form" noValidate>
                    <div className="form-field">
                        <label htmlFor="otp">Verification Code</label>

                        <input
                            id="otp"
                            type="text"
                            inputMode="numeric"
                            placeholder="Enter 6-digit OTP"
                            value={otp}
                            onChange={(e) => handleOTPChange(e.target.value)}
                            autoComplete="one-time-code"
                            maxLength={6}
                            required
                        />
                    </div>

                    {error && (
                        <p className="form-error" role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="login-button"
                        disabled={isLoading}
                    >
                        {isLoading ? "Verifying..." : "Verify OTP"}
                    </button>
                </form>

                <p className="register-link">
                    Didn't receive the code?{" "}
                    <button
                        type="button"
                        className="resend-button"
                        onClick={() => {
                            setOtp("");
                            setError("");
                            console.log("Resend OTP");
                        }}
                    >
                        Resend OTP
                    </button>
                </p>

                <p className="register-link">
                    <Link to="/login">Back to Login</Link>
                </p>
            </div>
        </main>
    );
}