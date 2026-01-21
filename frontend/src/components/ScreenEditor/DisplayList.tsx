import { Display } from "../../utils/trpc";

interface DisplayListProps {
    displays: Display[];
    selectedDisplayId: string | null;
    newDisplayName: string;
    onCreateDisplay: () => void;
    onSetNewDisplayName: (name: string) => void;
    onSelectDisplay: (id: string) => void;
    onDeleteDisplay: (id: string) => void;
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
        <section className="displays-panel">
            <h2>Displays</h2>
            <div className="display-list">
                {displays.map(display => (
                    <div
                        key={display.id}
                        className={`display-item ${selectedDisplayId === display.id ? "selected" : ""}`}
                        onClick={() => onSelectDisplay(display.id)}
                    >
                        <span className="display-name">{display.name || display.id}</span>
                        <span className="display-count">{display._count?.screens || 0}</span>
                        <button
                            className="btn-icon btn-delete"
                            onClick={(e) => { e.stopPropagation(); onDeleteDisplay(display.id); }}
                            title="Verwijderen"
                        >
                            x
                        </button>
                    </div>
                ))}
            </div>
            <div className="add-display-form">
                <input
                    type="text"
                    placeholder="Nieuwe display naam..."
                    value={newDisplayName}
                    onChange={(e) => onSetNewDisplayName(e.target.value)}
                    className="input-small"
                    onKeyDown={(e) => e.key === "Enter" && onCreateDisplay()}
                />
                <button className="btn-primary btn-small" onClick={onCreateDisplay}>+</button>
            </div>
        </section>
    );
}
