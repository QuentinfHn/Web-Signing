import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { trpcClient } from "../utils/trpc";

interface AuthState {
    isAuthenticated: boolean;
    authRequired: boolean;
    isLoading: boolean;
}

interface AuthContextType extends AuthState {
    login: (password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "led_controller_auth_token";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        isAuthenticated: false,
        authRequired: false,
        isLoading: true,
    });

    const getToken = useCallback(() => {
        return localStorage.getItem(TOKEN_KEY);
    }, []);

    const verifyAuth = useCallback(async () => {
        try {
            const result = await trpcClient.auth.verify.query();
            setState({
                isAuthenticated: result.authenticated,
                authRequired: result.authRequired,
                isLoading: false,
            });
        } catch (error) {
            console.error("Auth verification failed:", error);
            setState({
                isAuthenticated: false,
                authRequired: true,
                isLoading: false,
            });
        }
    }, []);

    useEffect(() => {
        verifyAuth();
    }, [verifyAuth]);

    const login = async (password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const result = await trpcClient.auth.login.mutate({ password });

            if (result.success && result.token) {
                localStorage.setItem(TOKEN_KEY, result.token);
                setState(prev => ({ ...prev, isAuthenticated: true }));
                return { success: true };
            } else if (result.success && !result.token) {
                // Auth not enabled
                setState(prev => ({ ...prev, isAuthenticated: true, authRequired: false }));
                return { success: true };
            }

            return { success: false, error: "Onbekende fout" };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Login mislukt";
            return { success: false, error: message };
        }
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        setState(prev => ({ ...prev, isAuthenticated: false }));
    };

    return (
        <AuthContext.Provider value={{ ...state, login, logout, getToken }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
