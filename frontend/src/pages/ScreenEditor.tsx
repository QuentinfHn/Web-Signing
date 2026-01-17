import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { trpcClient, Screen, Display } from "../utils/trpc";

type ConflictMode = "update" | "skip" | "error";

interface ImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
}

export default function ScreenEditor() {
    // Display state
    const [displays, setDisplays] = useState<Display[]>([]);
    const [newDisplayId, setNewDisplayId] = useState("");
    const [newDisplayName, setNewDisplayName] = useState("");

    // Screen state
    const [screens, setScreens] = useState<Screen[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Screen>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [newScreenData, setNewScreenData] = useState({
        displayId: "",
        x: 0,
        y: 0,
        width: 512,
        height: 512,
        name: "",
        lat: 0,
        lng: 0,
        address: "",
        postcode: "",
        huisnummer: "",
    });

    // Import/Export state
    const [showImportExport, setShowImportExport] = useState(false);
    const [conflictMode, setConflictMode] = useState<ConflictMode>("update");
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Selected display for viewing
    const [selectedDisplayId, setSelectedDisplayId] = useState<string | null>(null);

    // Fetch displays and screens on mount
    useEffect(() => {
        loadDisplays();
        loadScreens();
    }, []);

    // Auto-select first display
    useEffect(() => {
        if (displays.length > 0 && !selectedDisplayId) {
            setSelectedDisplayId(displays[0].id);
        }
    }, [displays, selectedDisplayId]);

    // Set default displayId for new screen
    useEffect(() => {
        if (displays.length > 0 && !newScreenData.displayId) {
            setNewScreenData(prev => ({ ...prev, displayId: displays[0].id }));
        }
    }, [displays, newScreenData.displayId]);

    const loadDisplays = async () => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await (trpcClient.displays as any).list.query();
            setDisplays(data);
            // Initialize displays from existing screens if none exist
            if (data.length === 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (trpcClient.displays as any).initFromScreens.mutate();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const newData = await (trpcClient.displays as any).list.query();
                setDisplays(newData);
            }
        } catch (error) {
            console.error("Failed to load displays:", error);
        }
    };

    const loadScreens = async () => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await (trpcClient.screens as any).list.query();
            setScreens(data);
        } catch (error) {
            console.error("Failed to load screens:", error);
        }
    };

    const [createLocationMode, setCreateLocationMode] = useState<"address" | "coords">("address");

    // Display handlers
    const handleCreateDisplay = async () => {
        if (!newDisplayId.trim()) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (trpcClient.displays as any).create.mutate({
                id: newDisplayId.trim(),
                name: newDisplayName.trim() || undefined,
            });
            setNewDisplayId("");
            setNewDisplayName("");
            await loadDisplays();
        } catch (error) {
            console.error("Failed to create display:", error);
            alert("Aanmaken mislukt - controleer of het ID uniek is");
        }
    };

    const handleDeleteDisplay = async (id: string) => {
        if (!confirm(`Weet je zeker dat je display "${id}" wilt verwijderen?`)) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (trpcClient.displays as any).delete.mutate({ id });
            await loadDisplays();
            if (selectedDisplayId === id) {
                setSelectedDisplayId(displays.find(d => d.id !== id)?.id || null);
            }
        } catch (error) {
            console.error("Failed to delete display:", error);
            alert(error instanceof Error ? error.message : "Verwijderen mislukt");
        }
    };

    // Geocoding helper
    const handleGeocode = async (address: string, isEditing: boolean) => {
        if (!address) {
            alert("Vul een adres in");
            return;
        }
        try {
            // Add ", Netherlands" to improve geocoding accuracy for Dutch addresses
            const searchQuery = address.includes("Nederland") ? address : `${address}, Netherlands`;
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon, display_name } = data[0];
                const latNum = parseFloat(lat);
                const lngNum = parseFloat(lon);

                if (isEditing) {
                    setFormData(prev => ({ ...prev, lat: latNum, lng: lngNum, address: display_name }));
                } else {
                    setNewScreenData(prev => ({ ...prev, lat: latNum, lng: lngNum, address: display_name }));
                }
                alert(`Locatie gevonden: ${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`);
            } else {
                alert("Adres niet gevonden");
            }
        } catch (error) {
            console.error("Geocoding failed:", error);
            alert("Fout bij zoeken locatie");
        }
    };

    // Screen handlers
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
                lat: formData.lat,
                lng: formData.lng,
                address: formData.address,
            });
            setEditingId(null);
            await loadScreens();
            await loadDisplays();
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
            await loadDisplays();
        } catch (error) {
            console.error("Failed to delete screen:", error);
        }
    };

    const handleCreate = async () => {
        if (!newScreenData.displayId) {
            alert("Display is verplicht");
            return;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (trpcClient.screens as any).create.mutate({
                displayId: newScreenData.displayId,
                x: newScreenData.x,
                y: newScreenData.y,
                width: newScreenData.width,
                height: newScreenData.height,
                name: newScreenData.name || null,
                lat: newScreenData.lat || null,
                lng: newScreenData.lng || null,
                address: newScreenData.address || null,
            });
            setIsCreating(false);
            setNewScreenData({
                displayId: displays[0]?.id || "",
                x: 0,
                y: 0,
                width: 512,
                height: 512,
                name: "",
                lat: 0,
                lng: 0,
                address: "",
                postcode: "",
                huisnummer: "",
            });
            await loadScreens();
            await loadDisplays();
        } catch (error) {
            console.error("Failed to create screen:", error);
            alert("Aanmaken mislukt");
        }
    };

    const handleNewScreenChange = (field: string, value: string | number) => {
        setNewScreenData(prev => ({ ...prev, [field]: value }));
    };

    const handleInputChange = (field: keyof Screen, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Export handler
    const handleExport = async () => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await (trpcClient.screens as any).exportAll.query();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `screens-export-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export mislukt");
        }
    };

    // Import handler
    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        setImportResult(null);
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.screens || !Array.isArray(data.screens)) {
                throw new Error("Ongeldig bestandsformaat: 'screens' array ontbreekt");
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (trpcClient.screens as any).importScreens.mutate({
                screens: data.screens,
                conflictMode,
            });
            setImportResult(result);
            await loadScreens();
            await loadDisplays();
        } catch (error) {
            console.error("Import failed:", error);
            setImportResult({
                created: 0,
                updated: 0,
                skipped: 0,
                errors: [error instanceof Error ? error.message : "Import mislukt"],
            });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    // Get screens for selected display
    const displayScreens = screens.filter(s => s.displayId === selectedDisplayId);

    // Calculate scale factor for visualizer
    const CANVAS_WIDTH = 1920;
    const CANVAS_HEIGHT = 1080;
    const VISUALIZER_WIDTH = 480;
    const scale = VISUALIZER_WIDTH / CANVAS_WIDTH;

    return (
        <div className="screen-editor compact">
            <header>
                <h1>Screen Editor</h1>
                <div className="header-actions">
                    <button
                        className={`toggle-btn ${showImportExport ? "active" : ""}`}
                        onClick={() => setShowImportExport(!showImportExport)}
                    >
                        Import/Export
                    </button>
                    <Link to="/" className="back-link">Terug</Link>
                </div>
            </header>

            {/* Import/Export Collapsible */}
            {showImportExport && (
                <section className="control-section compact-section">
                    <div className="import-export-row">
                        <button className="btn-secondary" onClick={handleExport}>Export JSON</button>
                        <div className="import-group">
                            <select
                                value={conflictMode}
                                onChange={(e) => setConflictMode(e.target.value as ConflictMode)}
                                className="select-small"
                            >
                                <option value="update">Overschrijven</option>
                                <option value="skip">Overslaan</option>
                                <option value="error">Fout melden</option>
                            </select>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                disabled={isImporting}
                                id="import-file"
                                className="file-input"
                            />
                            <label htmlFor="import-file" className="btn-secondary">
                                {isImporting ? "Importeren..." : "Import JSON"}
                            </label>
                        </div>
                    </div>
                    {importResult && (
                        <div className={`import-result-compact ${importResult.errors.length > 0 ? "has-errors" : ""}`}>
                            <span>{importResult.created} nieuw</span>
                            <span>{importResult.updated} bijgewerkt</span>
                            <span>{importResult.skipped} overgeslagen</span>
                            {importResult.errors.map((err, i) => (
                                <span key={i} className="error">{err}</span>
                            ))}
                            <button className="btn-small" onClick={() => setImportResult(null)}>x</button>
                        </div>
                    )}
                </section>
            )}

            {/* Two column layout */}
            <div className="editor-layout">
                {/* Left column: Display management */}
                <section className="displays-panel">
                    <h2>Displays</h2>
                    <div className="display-list">
                        {displays.map(display => (
                            <div
                                key={display.id}
                                className={`display-item ${selectedDisplayId === display.id ? "selected" : ""}`}
                                onClick={() => setSelectedDisplayId(display.id)}
                            >
                                <span className="display-name">{display.name || display.id}</span>
                                <span className="display-count">{display._count?.screens || 0}</span>
                                <button
                                    className="btn-icon btn-delete"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteDisplay(display.id); }}
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
                            placeholder="ID"
                            value={newDisplayId}
                            onChange={(e) => setNewDisplayId(e.target.value)}
                            className="input-small"
                        />
                        <input
                            type="text"
                            placeholder="Naam (optioneel)"
                            value={newDisplayName}
                            onChange={(e) => setNewDisplayName(e.target.value)}
                            className="input-small"
                        />
                        <button className="btn-primary btn-small" onClick={handleCreateDisplay}>+</button>
                    </div>
                </section>

                {/* Right column: Screen management for selected display */}
                <section className="screens-panel">
                    {selectedDisplayId ? (
                        <>
                            <div className="panel-header">
                                <h2>Schermen - {displays.find(d => d.id === selectedDisplayId)?.name || selectedDisplayId}</h2>
                                <button
                                    className={`btn-primary btn-small ${isCreating ? "active" : ""}`}
                                    onClick={() => {
                                        setIsCreating(!isCreating);
                                        setNewScreenData(prev => ({ ...prev, displayId: selectedDisplayId }));
                                    }}
                                >
                                    {isCreating ? "Annuleren" : "+ Scherm"}
                                </button>
                            </div>

                            {/* Add new screen form */}
                            {isCreating && (
                                <div className="screen-form-inline">
                                    <div className="form-row full-width">
                                        <label className="radio-label">
                                            <input
                                                type="radio"
                                                name="locationMode"
                                                checked={createLocationMode === "address"}
                                                onChange={() => setCreateLocationMode("address")}
                                            /> Adres & Auto-Locate
                                        </label>
                                        <label className="radio-label">
                                            <input
                                                type="radio"
                                                name="locationMode"
                                                checked={createLocationMode === "coords"}
                                                onChange={() => setCreateLocationMode("coords")}
                                            /> Handmatige Coördinaten
                                        </label>
                                    </div>

                                    <div className="form-fields-grid">
                                        <input
                                            type="text"
                                            placeholder="Naam"
                                            value={newScreenData.name}
                                            onChange={e => handleNewScreenChange("name", e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            placeholder="X"
                                            value={newScreenData.x}
                                            onChange={e => handleNewScreenChange("x", parseInt(e.target.value) || 0)}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Y"
                                            value={newScreenData.y}
                                            onChange={e => handleNewScreenChange("y", parseInt(e.target.value) || 0)}
                                        />
                                        <input
                                            type="number"
                                            placeholder="B"
                                            value={newScreenData.width}
                                            onChange={e => handleNewScreenChange("width", parseInt(e.target.value) || 0)}
                                        />
                                        <input
                                            type="number"
                                            placeholder="H"
                                            value={newScreenData.height}
                                            onChange={e => handleNewScreenChange("height", parseInt(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="location-fields-row">
                                        {createLocationMode === "address" ? (
                                            <>
                                                <input
                                                    type="text"
                                                    placeholder="Postcode"
                                                    value={newScreenData.postcode}
                                                    onChange={e => handleNewScreenChange("postcode", e.target.value.toUpperCase())}
                                                    className="input-postcode"
                                                    maxLength={7}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Huisnr"
                                                    value={newScreenData.huisnummer}
                                                    onChange={e => handleNewScreenChange("huisnummer", e.target.value)}
                                                    className="input-huisnummer"
                                                />
                                                <button
                                                    className="btn-secondary btn-small"
                                                    onClick={() => handleGeocode(`${newScreenData.postcode} ${newScreenData.huisnummer}`, false)}
                                                    disabled={!newScreenData.postcode || !newScreenData.huisnummer}
                                                >
                                                    📍 Zoek Locatie
                                                </button>
                                                <span className="location-preview">
                                                    {newScreenData.lat ? `(${newScreenData.lat.toFixed(4)}, ${newScreenData.lng.toFixed(4)})` : "Geen locatie"}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    placeholder="Lat"
                                                    value={newScreenData.lat}
                                                    onChange={e => handleNewScreenChange("lat", parseFloat(e.target.value) || 0)}
                                                />
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    placeholder="Lng"
                                                    value={newScreenData.lng}
                                                    onChange={e => handleNewScreenChange("lng", parseFloat(e.target.value) || 0)}
                                                />
                                            </>
                                        )}
                                    </div>

                                    <button className="btn-primary btn-small" onClick={handleCreate}>Toevoegen</button>
                                </div>
                            )}

                            {/* Visualizer */}
                            <div className="visualizer-container">
                                <div
                                    className="visualizer-canvas"
                                    style={{
                                        width: CANVAS_WIDTH * scale,
                                        height: CANVAS_HEIGHT * scale,
                                    }}
                                >
                                    <span className="canvas-label">1920x1080</span>
                                    {displayScreens.map(screen => (
                                        <div
                                            key={screen.id}
                                            className={`visualizer-screen ${editingId === screen.id ? "editing" : ""}`}
                                            style={{
                                                left: screen.x * scale,
                                                top: screen.y * scale,
                                                width: screen.width * scale,
                                                height: screen.height * scale,
                                            }}
                                            onClick={() => handleEdit(screen)}
                                            title={`${screen.name || screen.id}\n${screen.x},${screen.y} - ${screen.width}x${screen.height}`}
                                        >
                                            <span className="screen-label">{screen.name || screen.id}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Screen table */}
                            <table className="screen-table">
                                <thead>
                                    <tr>
                                        <th>Naam</th>
                                        <th>X</th>
                                        <th>Y</th>
                                        <th>B</th>
                                        <th>H</th>
                                        <th>Lat</th>
                                        <th>Lng</th>
                                        <th>Adres</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayScreens.map(screen => (
                                        editingId === screen.id ? (
                                            <tr key={screen.id} className="editing-row">
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={formData.name || ""}
                                                        onChange={e => handleInputChange("name", e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={formData.x || 0}
                                                        onChange={e => handleInputChange("x", parseInt(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={formData.y || 0}
                                                        onChange={e => handleInputChange("y", parseInt(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={formData.width || 0}
                                                        onChange={e => handleInputChange("width", parseInt(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={formData.height || 0}
                                                        onChange={e => handleInputChange("height", parseInt(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        step="0.000001"
                                                        value={formData.lat || 0}
                                                        onChange={e => handleInputChange("lat", parseFloat(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        step="0.000001"
                                                        value={formData.lng || 0}
                                                        onChange={e => handleInputChange("lng", parseFloat(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", gap: "5px" }}>
                                                        <input
                                                            type="text"
                                                            value={formData.address || ""}
                                                            onChange={e => handleInputChange("address", e.target.value)}
                                                        />
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => handleGeocode(formData.address || "", true)}
                                                            title="Zoek coordinaten"
                                                        >
                                                            📍
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="actions">
                                                    <button className="btn-icon btn-save" onClick={handleSave}>ok</button>
                                                    <button className="btn-icon" onClick={() => setEditingId(null)}>x</button>
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr key={screen.id} onClick={() => handleEdit(screen)}>
                                                <td>{screen.name || screen.id}</td>
                                                <td>{screen.x}</td>
                                                <td>{screen.y}</td>
                                                <td>{screen.width}</td>
                                                <td>{screen.height}</td>
                                                <td>{screen.lat?.toFixed(5)}</td>
                                                <td>{screen.lng?.toFixed(5)}</td>
                                                <td>{screen.address}</td>
                                                <td className="actions">
                                                    <button
                                                        className="btn-icon btn-delete"
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(screen.id); }}
                                                    >
                                                        x
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    ))}
                                </tbody>
                            </table>

                            {displayScreens.length === 0 && (
                                <p className="empty-message">Geen schermen. Voeg een scherm toe.</p>
                            )}
                        </>
                    ) : (
                        <p className="empty-message">Selecteer of maak een display om schermen te beheren.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
