import { Screen } from "../../utils/trpc";

interface ScreenCanvasProps {
    screens: Screen[];
    editingId: string | null;
    onScreenClick: (screen: Screen) => void;
}

export function ScreenCanvas({ screens, editingId, onScreenClick }: ScreenCanvasProps) {
    const CANVAS_WIDTH = 1920;
    const CANVAS_HEIGHT = 1080;
    const VISUALIZER_WIDTH = 480;
    const scale = VISUALIZER_WIDTH / CANVAS_WIDTH;

    return (
        <div className="visualizer-container">
            <div
                className="visualizer-canvas"
                style={{
                    width: CANVAS_WIDTH * scale,
                    height: CANVAS_HEIGHT * scale,
                }}
            >
                <span className="canvas-label">1920x1080</span>
                {screens.map(screen => (
                    <div
                        key={screen.id}
                        className={`visualizer-screen ${editingId === screen.id ? "editing" : ""}`}
                        style={{
                            left: screen.x * scale,
                            top: screen.y * scale,
                            width: screen.width * scale,
                            height: screen.height * scale,
                        }}
                        onClick={() => onScreenClick(screen)}
                        title={`${screen.name || screen.id}\n${screen.x},${screen.y} - ${screen.width}x${screen.height}`}
                    >
                        <span className="screen-label">{screen.name || screen.id}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
