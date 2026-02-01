import { useEffect, useRef, useState } from "react";
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
    onRenameDisplay: (id: string, name: string) => Promise<boolean>;
}

export function DisplayList({
    displays,
    selectedDisplayId,
    newDisplayName,
    onCreateDisplay,
    onSetNewDisplayName,
    onSelectDisplay,
    onDeleteDisplay,
    onRenameDisplay,
}: DisplayListProps) {
    const [editingDisplayId, setEditingDisplayId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const editInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (editingDisplayId) {
            editInputRef.current?.focus();
            editInputRef.current?.select();
        }
    }, [editingDisplayId]);

    useEffect(() => {
        if (editingDisplayId && !displays.some(display => display.id === editingDisplayId)) {
            setEditingDisplayId(null);
            setEditingName("");
        }
    }, [displays, editingDisplayId]);

    const startEditing = (display: Display) => {
        setEditingDisplayId(display.id);
        setEditingName(display.name || display.id);
    };

    const cancelEditing = () => {
        setEditingDisplayId(null);
        setEditingName("");
    };

    const saveEditing = async () => {
        if (!editingDisplayId) return;
        const trimmedName = editingName.trim();
        if (!trimmedName) return;
        const currentDisplay = displays.find(display => display.id === editingDisplayId);
        const currentName = currentDisplay?.name || currentDisplay?.id || "";
        if (trimmedName === currentName) {
            cancelEditing();
            return;
        }
        const success = await onRenameDisplay(editingDisplayId, trimmedName);
        if (success) {
            cancelEditing();
        }
    };

    const handleSelectDisplay = (id: string) => {
        if (editingDisplayId && editingDisplayId !== id) {
            cancelEditing();
        }
        onSelectDisplay(id);
    };

    return (
        <section className={styles.displaysPanel}>
            <h2>Displays</h2>
            <div className={styles.displayList}>
                {displays.map(display => (
                    <div
                        key={display.id}
                        className={`${styles.displayItem} ${selectedDisplayId === display.id ? styles.selected : ""}`}
                        onClick={() => handleSelectDisplay(display.id)}
                    >
                        {editingDisplayId === display.id ? (
                            <input
                                ref={editInputRef}
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        void saveEditing();
                                    }
                                    if (e.key === "Escape") {
                                        e.preventDefault();
                                        cancelEditing();
                                    }
                                }}
                                className={`${formStyles.inputSmall} ${styles.displayNameInput}`}
                            />
                        ) : (
                            <span className={styles.displayName}>{display.name || display.id}</span>
                        )}
                        <span className={styles.displayCount}>{display._count?.screens || 0}</span>
                        <div className={styles.displayActions}>
                            {editingDisplayId === display.id ? (
                                <>
                                    <button
                                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnSave}`}
                                        onClick={(e) => { e.stopPropagation(); void saveEditing(); }}
                                        title="Opslaan"
                                    >
                                        ✓
                                    </button>
                                    <button
                                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnDelete}`}
                                        onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                                        title="Annuleren"
                                    >
                                        x
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnEdit}`}
                                        onClick={(e) => { e.stopPropagation(); startEditing(display); }}
                                        title="Bewerken"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnDelete}`}
                                        onClick={(e) => { e.stopPropagation(); onDeleteDisplay(display.id, display.name || display.id); }}
                                        title="Verwijderen"
                                    >
                                        x
                                    </button>
                                </>
                            )}
                        </div>
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
