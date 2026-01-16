import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { trpcClient, Screen } from "../utils/trpc";

export default function ScreenEditor() {
    const [screens, setScreens] = useState<Screen[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Screen>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [newScreenData, setNewScreenData] = useState({
        id: "",
        displayId: "display1",
        x: 0,
        y: 0,
        width: 512,
        height: 512,
        name: "",
    });

    // Fetch screens on mount
    useEffect(() => {
        loadScreens();
    }, []);

    const loadScreens = async () => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await (trpcClient.screens as any).list.query();
            setScreens(data);
        } catch (error) {
            console.error("Failed to load screens:", error);
        }
    };

    const handleEdit = (screen: Screen) => {
        setEditingId(screen.id);
        setFormData(screen);
    };

    const handleSave = async () => {
        if (!editingId || !formData) return;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (trpcClient.screens as any).update.mutate({
                id: editingId,
                x: formData.x,
                y: formData.y,
                width: formData.width,
                height: formData.height,
                name: formData.name,
                displayId: formData.displayId,
            });
            setEditingId(null);
            await loadScreens();
        } catch (error) {
            console.error("Failed to save screen:", error);
            alert("Opslaan mislukt");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Weet je zeker dat je dit scherm wilt verwijderen?")) return;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (trpcClient.screens as any).delete.mutate({ id });
            await loadScreens();
        } catch (error) {
            console.error("Failed to delete screen:", error);
        }
    };

    const handleCreate = async () => {
        if (!newScreenData.id.trim()) {
            alert("ID is verplicht");
            return;
        }
        if (!newScreenData.displayId.trim()) {
            alert("Display ID is verplicht");
            return;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (trpcClient.screens as any).create.mutate({
                id: newScreenData.id,
                displayId: newScreenData.displayId,
                x: newScreenData.x,
                y: newScreenData.y,
                width: newScreenData.width,
                height: newScreenData.height,
                name: newScreenData.name || null,
            });
            setIsCreating(false);
            setNewScreenData({
                id: "",
                displayId: "display1",
                x: 0,
                y: 0,
                width: 512,
                height: 512,
                name: "",
            });
            await loadScreens();
        } catch (error) {
            console.error("Failed to create screen:", error);
            alert("Aanmaken mislukt - controleer of het ID uniek is");
        }
    };

    const handleNewScreenChange = (field: string, value: string | number) => {
        setNewScreenData(prev => ({ ...prev, [field]: value }));
    };

    const handleInputChange = (field: keyof Screen, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Group screens by displayId
    const screensByDisplay = screens.reduce((acc, screen) => {
        if (!acc[screen.displayId]) {
            acc[screen.displayId] = [];
        }
        acc[screen.displayId].push(screen);
        return acc;
    }, {} as Record<string, Screen[]>);

    // Calculate scale factor for visualizer (fit 1920x1080 in ~600px width)
    const CANVAS_WIDTH = 1920;
    const CANVAS_HEIGHT = 1080;
    const VISUALIZER_WIDTH = 600;
    const scale = VISUALIZER_WIDTH / CANVAS_WIDTH;

    return (
        <div className="screen-editor">
            <header>
                <h1>📐 Screen Editor</h1>
                <Link to="/" className="back-link">← Terug</Link>
            </header>

            {/* Create New Screen Section */}
            <section className="control-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2>➕ Nieuw Scherm</h2>
                    {!isCreating && (
                        <button className="save-btn" onClick={() => setIsCreating(true)}>
                            + Scherm Toevoegen
                        </button>
                    )}
                </div>

                {isCreating && (
                    <div className="screen-edit-card">
                        <div className="screen-form">
                            <div className="form-row">
                                <label>ID (uniek):</label>
                                <input
                                    type="text"
                                    value={newScreenData.id}
                                    onChange={e => handleNewScreenChange("id", e.target.value)}
                                    placeholder="bijv. mijnscherm1"
                                />
                            </div>
                            <div className="form-row">
                                <label>Display:</label>
                                <select
                                    value={newScreenData.displayId}
                                    onChange={e => handleNewScreenChange("displayId", e.target.value)}
                                >
                                    <option value="display1">display1</option>
                                    <option value="display2">display2</option>
                                </select>
                            </div>
                            <div className="form-row">
                                <label>Naam (optioneel):</label>
                                <input
                                    type="text"
                                    value={newScreenData.name}
                                    onChange={e => handleNewScreenChange("name", e.target.value)}
                                    placeholder="bijv. Hoofdscherm"
                                />
                            </div>
                            <div className="form-grid">
                                <div className="form-row">
                                    <label>X:</label>
                                    <input
                                        type="number"
                                        value={newScreenData.x}
                                        onChange={e => handleNewScreenChange("x", parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="form-row">
                                    <label>Y:</label>
                                    <input
                                        type="number"
                                        value={newScreenData.y}
                                        onChange={e => handleNewScreenChange("y", parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="form-row">
                                    <label>Breedte:</label>
                                    <input
                                        type="number"
                                        value={newScreenData.width}
                                        onChange={e => handleNewScreenChange("width", parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="form-row">
                                    <label>Hoogte:</label>
                                    <input
                                        type="number"
                                        value={newScreenData.height}
                                        onChange={e => handleNewScreenChange("height", parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button className="save-btn" onClick={handleCreate}>➕ Aanmaken</button>
                                <button className="cancel-btn" onClick={() => setIsCreating(false)}>Annuleren</button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {Object.entries(screensByDisplay).map(([displayId, displayScreens]) => (
                <section key={displayId} className="control-section">
                    <h2>📺 {displayId}</h2>

                    {/* Visualizer */}
                    <div className="screen-visualizer">
                        <div
                            className="visualizer-canvas"
                            style={{
                                width: CANVAS_WIDTH * scale,
                                height: CANVAS_HEIGHT * scale,
                            }}
                        >
                            <span className="canvas-label">1920×1080</span>
                            {displayScreens.map(screen => (
                                <div
                                    key={screen.id}
                                    className={`visualizer-screen ${editingId === screen.id ? 'editing' : ''}`}
                                    style={{
                                        left: screen.x * scale,
                                        top: screen.y * scale,
                                        width: screen.width * scale,
                                        height: screen.height * scale,
                                    }}
                                    onClick={() => handleEdit(screen)}
                                    title={`${screen.name || screen.id}\n${screen.x},${screen.y} - ${screen.width}×${screen.height}`}
                                >
                                    <span className="screen-label">{screen.name || screen.id}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="screen-list">
                        {displayScreens.map(screen => (
                            <div key={screen.id} className="screen-edit-card">
                                {editingId === screen.id ? (
                                    <div className="screen-form">
                                        <div className="form-row">
                                            <label>ID:</label>
                                            <input type="text" value={screen.id} disabled />
                                        </div>
                                        <div className="form-row">
                                            <label>Naam:</label>
                                            <input
                                                type="text"
                                                value={formData.name || ""}
                                                onChange={e => handleInputChange("name", e.target.value)}
                                            />
                                        </div>
                                        <div className="form-grid">
                                            <div className="form-row">
                                                <label>X:</label>
                                                <input
                                                    type="number"
                                                    value={formData.x || 0}
                                                    onChange={e => handleInputChange("x", parseInt(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div className="form-row">
                                                <label>Y:</label>
                                                <input
                                                    type="number"
                                                    value={formData.y || 0}
                                                    onChange={e => handleInputChange("y", parseInt(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div className="form-row">
                                                <label>Breedte:</label>
                                                <input
                                                    type="number"
                                                    value={formData.width || 0}
                                                    onChange={e => handleInputChange("width", parseInt(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div className="form-row">
                                                <label>Hoogte:</label>
                                                <input
                                                    type="number"
                                                    value={formData.height || 0}
                                                    onChange={e => handleInputChange("height", parseInt(e.target.value) || 0)}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-actions">
                                            <button className="save-btn" onClick={handleSave}>💾 Opslaan</button>
                                            <button className="cancel-btn" onClick={() => setEditingId(null)}>Annuleren</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="screen-info">
                                        <div className="screen-header">
                                            <strong>{screen.name || screen.id}</strong>
                                            <span className="screen-id">{screen.id}</span>
                                        </div>
                                        <div className="screen-details">
                                            <span>📍 X: {screen.x}, Y: {screen.y}</span>
                                            <span>📏 {screen.width} × {screen.height}</span>
                                        </div>
                                        <div className="screen-actions">
                                            <button className="edit-btn" onClick={() => handleEdit(screen)}>✏️ Bewerken</button>
                                            <button className="delete-btn" onClick={() => handleDelete(screen.id)}>🗑️</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
