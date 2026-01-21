import { Screen } from "../../utils/trpc";
import styles from "../../pages/ScreenEditor.module.css";

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
        <div className={styles.visualizerContainer}>
            <div
                className={styles.visualizerCanvas}
                style={{
                    width: CANVAS_WIDTH * scale,
                    height: CANVAS_HEIGHT * scale,
                }}
            >
                <span className={styles.canvasLabel}>1920x1080</span>
                {screens.map(screen => (
                    <div
                        key={screen.id}
                        className={`${styles.visualizerScreen} ${editingId === screen.id ? styles.editing : ""}`}
                        style={{
                            left: screen.x * scale,
                            top: screen.y * scale,
                            width: screen.width * scale,
                            height: screen.height * scale,
                        }}
                        onClick={() => onScreenClick(screen)}
                        title={`${screen.name || screen.id}\n${screen.x},${screen.y} - ${screen.width}x${screen.height}`}
                    >
                        <span className={styles.screenLabel}>{screen.name || screen.id}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
