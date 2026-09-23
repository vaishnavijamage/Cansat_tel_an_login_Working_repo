import { Navigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";

import { getCurrentUser } from "../services/api";

type ProtectedStudentRouteProps = {
    children: ReactNode;
};

export default function ProtectedStudentRoute({
    children,
}: ProtectedStudentRouteProps) {

    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {

        const checkStudentSession = async () => {

            try {

                const response =
                    await getCurrentUser();

                if (
                    response?.success &&
                    response?.user?.type === "student"
                ) {
                    setAuthorized(true);
                } else {
                    setAuthorized(false);
                }

            } catch (error) {

                console.error(
                    "Student authentication check failed:",
                    error
                );

                setAuthorized(false);

            } finally {

                setLoading(false);

            }
        };

        checkStudentSession();

    }, []);


    if (loading) {
        return (
            <div className="dashboard-loading">
                Checking authentication...
            </div>
        );
    }


    if (!authorized) {
        return (
            <Navigate
                to="/login?type=student"
                replace
            />
        );
    }


    return <>{children}</>;
}