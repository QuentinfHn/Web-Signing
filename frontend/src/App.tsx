import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Control from "./pages/Control";
import Display from "./pages/Display";
import ContentManager from "./pages/ContentManager";
import ScreenEditor from "./pages/ScreenEditor";

function Home() {
    return (
        <div className="home">
            <h1>🎮 LED Controller</h1>
            <p>Kies een pagina om te openen:</p>
            <nav className="nav-links">
                <Link to="/control" className="nav-link">
                    🕹️ Control Panel
                </Link>
                <Link to="/content" className="nav-link">
                    📁 Content Manager
                </Link>
                <Link to="/screens" className="nav-link">
                    📐 Screen Editor
                </Link>
                <Link to="/display?display=display1" className="nav-link">
                    📺 Display 1
                </Link>
                <Link to="/display?display=display2" className="nav-link">
                    📺 Display 2
                </Link>
            </nav>
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
                <Route path="/display" element={<Display />} />
            </Routes>
        </BrowserRouter>
    );
}
