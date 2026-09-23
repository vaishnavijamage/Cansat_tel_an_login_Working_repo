import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser } from "../services/api";

type Props = {
    children: React.ReactNode;
};

export default function ProtectedSchoolRoute({
    children,
}: Props) {
    const [loading, setLoading] = useState(true);
    const [isSchool, setIsSchool] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const response = await getCurrentUser();

                if (
                    response.success &&
                    response.user &&
                    response.user.type === "school"
                ) {
                    setIsSchool(true);
                } else {
                    setIsSchool(false);
                }
            } catch (error) {
                console.error("Authentication check failed:", error);
                setIsSchool(false);
            } finally {
                setLoading(false);
            }
        };

        checkUser();
    }, []);

    if (loading) {
        return (
            <div className="auth-loading">
                Checking authentication...
            </div>
        );
    }

    if (!isSchool) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}