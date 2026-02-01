import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import LoginModal from "./LoginModal";

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, authRequired, isLoading } = useAuth();

    // Show loading state while verifying auth
    if (isLoading) {
        return (
            <div className="auth-loading">
                <div className="auth-loading-spinner" />
            </div>
        );
    }

    // If auth is not required, allow access
    if (!authRequired) {
        return <>{children}</>;
    }

    // If authenticated, allow access
    if (isAuthenticated) {
        return <>{children}</>;
    }

    // Show login modal
    return <LoginModal />;
}
