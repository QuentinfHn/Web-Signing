import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Control from "./pages/Control";
import Display from "./pages/Display";
import ContentManager from "./pages/ContentManager";
import ScreenEditor from "./pages/ScreenEditor";
import MapOverview from "./pages/MapOverview";
import { trpcClient, Display as DisplayType } from "./utils/trpc";

function Home() {
    const [displays, setDisplays] = useState<DisplayType[]>([]);

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
        <div className="home">
            <p>Kies een pagina om te openen:</p>
            <nav className="nav-links">
                <Link to="/control" className="nav-link">
                    Control Panel
                </Link>
                <Link to="/content" className="nav-link">
                    Content Manager
                </Link>
                <Link to="/screens" className="nav-link">
                    Screen Editor
                </Link>
                <Link to="/map" className="nav-link">
                    Map Overview
                </Link>
            </nav>
            {displays.length > 0 && (
                <>
                    <p className="section-label">Displays:</p>
                    <nav className="nav-links">
                        {displays.map(display => (
                            <Link
                                key={display.id}
                                to={`/display?display=${display.id}`}
                                className="nav-link display-link"
                            >
                                {display.name || display.id}
                            </Link>
                        ))}
                    </nav>
                </>
            )}
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/control" element={<Control />} />
                <Route path="/content" element={<ContentManager />} />
                <Route path="/screens" element={<ScreenEditor />} />
                <Route path="/map" element={<MapOverview />} />
                <Route path="/display" element={<Display />} />
            </Routes>
        </BrowserRouter>
    );
}
