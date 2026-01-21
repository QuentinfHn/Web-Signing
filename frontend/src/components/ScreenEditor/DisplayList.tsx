import { Display } from "../../utils/trpc";
import styles from "../../pages/ScreenEditor.module.css";
import buttonStyles from "../Button.module.css";
import formStyles from "../Form.module.css";

interface DisplayListProps {
    displays: Display[];
    selectedDisplayId: string | null;
    newDisplayName: string;
    onCreateDisplay: () => void;
    onSetNewDisplayName: (name: string) => void;
    onSelectDisplay: (id: string) => void;
    onDeleteDisplay: (id: string, name: string) => void;
}

export function DisplayList({
    displays,
    selectedDisplayId,
    newDisplayName,
    onCreateDisplay,
    onSetNewDisplayName,
    onSelectDisplay,
    onDeleteDisplay,
}: DisplayListProps) {
    return (
        <section className={styles.displaysPanel}>
            <h2>Displays</h2>
            <div className={styles.displayList}>
                {displays.map(display => (
                    <div
                        key={display.id}
                        className={`${styles.displayItem} ${selectedDisplayId === display.id ? styles.selected : ""}`}
                        onClick={() => onSelectDisplay(display.id)}
                    >
                        <span className={styles.displayName}>{display.name || display.id}</span>
                        <span className={styles.displayCount}>{display._count?.screens || 0}</span>
                        <button
                            className={`${buttonStyles.btnIcon} ${buttonStyles.btnDelete}`}
                            onClick={(e) => { e.stopPropagation(); onDeleteDisplay(display.id, display.name || display.id); }}
                            title="Verwijderen"
                        >
                            x
                        </button>
                    </div>
                ))}
            </div>
            <div className={styles.addDisplayForm}>
                <input
                    type="text"
                    placeholder="Nieuwe display naam..."
                    value={newDisplayName}
                    onChange={(e) => onSetNewDisplayName(e.target.value)}
                    className={formStyles.inputSmall}
                    onKeyDown={(e) => e.key === "Enter" && onCreateDisplay()}
                />
                <button className={`${buttonStyles.btnPrimary} ${buttonStyles.btnSmall}`} onClick={onCreateDisplay}>+</button>
            </div>
        </section>
    );
}
