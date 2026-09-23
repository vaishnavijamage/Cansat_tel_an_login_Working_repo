import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:5000";

type Props = {
    children: React.ReactNode;
};

export default function ProtectedAdminRoute({
    children,
}: Props) {
    const [checking, setChecking] = useState(true);
    const [authenticated, setAuthenticated] =
        useState(false);

    useEffect(() => {
        async function checkAdminSession() {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/auth/admin/me`,
                    {
                        method: "GET",
                        credentials: "include",
                    }
                );

                if (response.ok) {
                    const data = await response.json();

                    if (
                        data.success &&
                        data.admin?.userType === "admin"
                    ) {
                        setAuthenticated(true);
                    }
                }
            } catch (error) {
                console.error(
                    "Admin authentication check failed:",
                    error
                );
            } finally {
                setChecking(false);
            }
        }

        checkAdminSession();
    }, []);

    if (checking) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Arial, sans-serif",
                }}
            >
                Checking authentication...
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/admin-login" replace />;
    }

    return <>{children}</>;
}