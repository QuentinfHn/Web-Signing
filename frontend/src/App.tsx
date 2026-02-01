import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Control from "./pages/Control";
import Display from "./pages/Display";
import ContentManager from "./pages/ContentManager";
import ScreenEditor from "./pages/ScreenEditor";
import MapOverview from "./pages/MapOverview";
import { trpcClient, Display as DisplayType } from "./utils/trpc";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import styles from "./pages/Home.module.css";
import buttonStyles from "./components/Button.module.css";

function Home() {
    const [displays, setDisplays] = useState<DisplayType[]>([]);
    const { isAuthenticated, authRequired, logout } = useAuth();

    useEffect(() => {
        const loadDisplays = async () => {
            try {

                const data = await trpcClient.displays.list.query();
                setDisplays(data);
            } catch (error) {
                console.error("Failed to load displays:", error);
            }
        };
        loadDisplays();
    }, []);

    return (
        <div className={styles.home}>
            <p>Kies een pagina om te openen:</p>
            <nav className={styles.navLinks}>
                <Link to="/control" className={styles.navLink}>
                    Control Panel
                </Link>
                <Link to="/content" className={styles.navLink}>
                    Content Manager
                </Link>
                <Link to="/screens" className={styles.navLink}>
                    Screen Editor
                </Link>
                <Link to="/map" className={styles.navLink}>
                    Map Overview
                </Link>
            </nav>
            {displays.length > 0 && (
                <>
                    <p className={styles.sectionLabel}>Displays:</p>
                    <nav className={styles.navLinks}>
                        {displays.map(display => (
                            <Link
                                key={display.id}
                                to={`/display/${display.id}`}
                                className={`${styles.navLink} ${styles.navLinkDisplayLink}`}
                            >
                                {display.name || display.id}
                            </Link>
                        ))}
                    </nav>
                </>
            )}
            {authRequired && isAuthenticated && (
                <div className={styles.authStatus}>
                    <button onClick={logout} className={`${buttonStyles.btnSecondary} ${buttonStyles.btnLogout}`}>
                        Uitloggen
                    </button>
                </div>
            )}
        </div>
    );
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/control" element={
                <ProtectedRoute>
                    <Control />
                </ProtectedRoute>
            } />
            <Route path="/content" element={
                <ProtectedRoute>
                    <ContentManager />
                </ProtectedRoute>
            } />
            <Route path="/screens" element={
                <ProtectedRoute>
                    <ScreenEditor />
                </ProtectedRoute>
            } />
            <Route path="/map" element={
                <ProtectedRoute>
                    <MapOverview />
                </ProtectedRoute>
            } />
            <Route path="/display/:displayId" element={<Display />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}
