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

    // Delete confirmation dialog
    const [deleteConfirm, setDeleteConfirm] = useState<{
        show: boolean;
        type: "screen" | "display";
        id: string;
        name: string;
    } | null>(null);

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
            const data = await trpcClient.displays.list.query();
            setDisplays(data);
            // Initialize displays from existing screens if none exist
            if (data.length === 0) {
                await trpcClient.displays.initFromScreens.mutate();
                const newData = await trpcClient.displays.list.query();
                setDisplays(newData);
            }
        } catch (error) {
            console.error("Failed to load displays:", error);
        }
    };

    const loadScreens = async () => {
        try {
            const data = await trpcClient.screens.list.query();
            setScreens(data);
        } catch (error) {
            console.error("Failed to load screens:", error);
        }
    };

    const [createLocationMode, setCreateLocationMode] = useState<"address" | "coords">("address");
    const [editLocationMode, setEditLocationMode] = useState<"address" | "coords">("address");
    const [editPostcode, setEditPostcode] = useState("");
    const [editHuisnummer, setEditHuisnummer] = useState("");

    // Display handlers
    const handleCreateDisplay = async () => {
        if (!newDisplayName.trim()) return;
        try {
            await trpcClient.displays.create.mutate({
                name: newDisplayName.trim(),
            });
            setNewDisplayName("");
            await loadDisplays();
        } catch (error) {
            console.error("Failed to create display:", error);
            alert("Aanmaken mislukt - controleer of de naam uniek is");
        }
    };

    const showDeleteDisplayConfirm = (id: string, name: string) => {
        setDeleteConfirm({ show: true, type: "display", id, name: name || id });
    };

    const handleDeleteDisplay = async (id: string) => {
        try {
            await trpcClient.displays.delete.mutate({ id });
            await loadDisplays();
            if (selectedDisplayId === id) {
                setSelectedDisplayId(displays.find(d => d.id !== id)?.id || null);
            }
        } catch (error) {
            console.error("Failed to delete display:", error);
            alert(error instanceof Error ? error.message : "Verwijderen mislukt");
        }
    };

    // Geocoding helper using PDOK Locatieserver (Dutch government API for address lookup)
    const handleGeocode = async (address: string, isEditing: boolean) => {
        if (!address) {
            alert("Vul een adres in");
            return;
        }
        try {
            // Use PDOK Locatieserver - specifically designed for Dutch addresses
            // Works perfectly with postcode + huisnummer format like "2811GN 18"
            const response = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(address)}&fq=type:adres&rows=1`);
            const data = await response.json();

            if (data?.response?.docs?.length > 0) {
                const result = data.response.docs[0];
                // PDOK returns centroide_ll as "POINT(lng lat)" format
                const pointMatch = result.centroide_ll?.match(/POINT\(([\d.]+) ([\d.]+)\)/);

                if (pointMatch) {
                    const lngNum = parseFloat(pointMatch[1]);
                    const latNum = parseFloat(pointMatch[2]);
                    const displayName = result.weergavenaam || address;

                    if (isEditing) {
                        setFormData(prev => ({ ...prev, lat: latNum, lng: lngNum, address: displayName }));
                    } else {
                        setNewScreenData(prev => ({ ...prev, lat: latNum, lng: lngNum, address: displayName }));
                    }
                    alert(`Locatie gevonden: ${displayName}`);
                } else {
                    alert("Adres niet gevonden (geen coördinaten)");
                }
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
        setEditPostcode("");
        setEditHuisnummer("");
        // Default to address mode if there's an address, otherwise coords
        setEditLocationMode(screen.address ? "address" : "coords");
        // Close create form if open
        setIsCreating(false);
    };

    const handleSave = async () => {
        if (!editingId || !formData) return;
        try {
            await trpcClient.screens.update.mutate({
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

    const showDeleteScreenConfirm = (id: string, name: string) => {
        setDeleteConfirm({ show: true, type: "screen", id, name: name || id });
    };

    const handleDelete = async (id: string) => {
        try {
            await trpcClient.screens.delete.mutate({ id });
            setEditingId(null);
            await loadScreens();
            await loadDisplays();
        } catch (error) {
            console.error("Failed to delete screen:", error);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === "display") {
            await handleDeleteDisplay(deleteConfirm.id);
        } else {
            await handleDelete(deleteConfirm.id);
        }
        setDeleteConfirm(null);
    };

    const handleCreate = async () => {
        if (!newScreenData.displayId) {
            alert("Display is verplicht");
            return;
        }
        try {
            await trpcClient.screens.create.mutate({
                displayId: newScreenData.displayId,
                x: newScreenData.x,
                y: newScreenData.y,
                width: newScreenData.width,
                height: newScreenData.height,
                name: newScreenData.name || undefined,
                lat: newScreenData.lat || undefined,
                lng: newScreenData.lng || undefined,
                address: newScreenData.address || undefined,
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
            const data = await trpcClient.screens.exportAll.query();
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
            const result = await trpcClient.screens.importScreens.mutate({
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
                                    onClick={(e) => { e.stopPropagation(); showDeleteDisplayConfirm(display.id, display.name || ""); }}
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
                            onChange={(e) => setNewDisplayName(e.target.value)}
                            className="input-small"
                            onKeyDown={(e) => e.key === "Enter" && handleCreateDisplay()}
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
                                    className={`btn-primary ${isCreating ? "btn-cancel" : ""}`}
                                    onClick={() => {
                                        setIsCreating(!isCreating);
                                        setNewScreenData(prev => ({ ...prev, displayId: selectedDisplayId }));
                                    }}
                                >
                                    {isCreating ? "Annuleren" : "+ Nieuw Scherm"}
                                </button>
                            </div>

                            {/* Add new screen form - Modal style */}
                            {isCreating && (
                                <div className="screen-create-modal">
                                    <div className="modal-header">
                                        <h3>📺 Nieuw Scherm Toevoegen</h3>
                                    </div>

                                    <div className="modal-content">
                                        {/* Basic Info Section */}
                                        <div className="form-section">
                                            <h4>Basis Informatie</h4>
                                            <div className="form-group">
                                                <label htmlFor="screen-name">Schermnaam</label>
                                                <input
                                                    id="screen-name"
                                                    type="text"
                                                    placeholder="bijv. Lobby Display 1"
                                                    value={newScreenData.name}
                                                    onChange={e => handleNewScreenChange("name", e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Position & Size Section */}
                                        <div className="form-section">
                                            <h4>Positie & Afmetingen</h4>
                                            <p className="section-help">Positie in pixels binnen het 1920×1080 canvas</p>
                                            <div className="form-grid-2x2">
                                                <div className="form-group">
                                                    <label htmlFor="screen-x">X Positie</label>
                                                    <input
                                                        id="screen-x"
                                                        type="number"
                                                        value={newScreenData.x}
                                                        onChange={e => handleNewScreenChange("x", parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label htmlFor="screen-y">Y Positie</label>
                                                    <input
                                                        id="screen-y"
                                                        type="number"
                                                        value={newScreenData.y}
                                                        onChange={e => handleNewScreenChange("y", parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label htmlFor="screen-width">Breedte (px)</label>
                                                    <input
                                                        id="screen-width"
                                                        type="number"
                                                        value={newScreenData.width}
                                                        onChange={e => handleNewScreenChange("width", parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label htmlFor="screen-height">Hoogte (px)</label>
                                                    <input
                                                        id="screen-height"
                                                        type="number"
                                                        value={newScreenData.height}
                                                        onChange={e => handleNewScreenChange("height", parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Location Section */}
                                        <div className="form-section">
                                            <h4>Fysieke Locatie</h4>
                                            <p className="section-help">Optioneel: voor weergave op de kaart</p>

                                            <div className="location-mode-toggle">
                                                <button
                                                    type="button"
                                                    className={`mode-btn ${createLocationMode === "address" ? "active" : ""}`}
                                                    onClick={() => setCreateLocationMode("address")}
                                                >
                                                    📮 Adres Invoeren
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`mode-btn ${createLocationMode === "coords" ? "active" : ""}`}
                                                    onClick={() => setCreateLocationMode("coords")}
                                                >
                                                    🌐 Coördinaten
                                                </button>
                                            </div>

                                            {createLocationMode === "address" ? (
                                                <div className="location-address-form">
                                                    <div className="form-row-inline">
                                                        <div className="form-group flex-1">
                                                            <label htmlFor="screen-postcode">Postcode</label>
                                                            <input
                                                                id="screen-postcode"
                                                                type="text"
                                                                placeholder="1234AB"
                                                                value={newScreenData.postcode}
                                                                onChange={e => handleNewScreenChange("postcode", e.target.value.toUpperCase())}
                                                                maxLength={7}
                                                                className="input-uppercase"
                                                            />
                                                        </div>
                                                        <div className="form-group flex-half">
                                                            <label htmlFor="screen-huisnummer">Huisnr.</label>
                                                            <input
                                                                id="screen-huisnummer"
                                                                type="text"
                                                                placeholder="123"
                                                                value={newScreenData.huisnummer}
                                                                onChange={e => handleNewScreenChange("huisnummer", e.target.value)}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn-geocode"
                                                            onClick={() => handleGeocode(`${newScreenData.postcode} ${newScreenData.huisnummer}`, false)}
                                                            disabled={!newScreenData.postcode || !newScreenData.huisnummer}
                                                        >
                                                            📍 Zoek
                                                        </button>
                                                    </div>
                                                    {newScreenData.address && (
                                                        <div className="location-result">
                                                            <span className="result-icon">✓</span>
                                                            <span className="result-text">{newScreenData.address}</span>
                                                        </div>
                                                    )}
                                                    {!newScreenData.address && newScreenData.lat !== 0 && (
                                                        <div className="location-result coords">
                                                            <span>📍 {newScreenData.lat.toFixed(5)}, {newScreenData.lng.toFixed(5)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="location-coords-form">
                                                    <div className="form-row-inline">
                                                        <div className="form-group flex-1">
                                                            <label htmlFor="screen-lat">Latitude</label>
                                                            <input
                                                                id="screen-lat"
                                                                type="number"
                                                                step="0.000001"
                                                                placeholder="52.12345"
                                                                value={newScreenData.lat || ""}
                                                                onChange={e => handleNewScreenChange("lat", parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                        <div className="form-group flex-1">
                                                            <label htmlFor="screen-lng">Longitude</label>
                                                            <input
                                                                id="screen-lng"
                                                                type="number"
                                                                step="0.000001"
                                                                placeholder="4.12345"
                                                                value={newScreenData.lng || ""}
                                                                onChange={e => handleNewScreenChange("lng", parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="modal-footer">
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setIsCreating(false)}
                                        >
                                            Annuleren
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-primary btn-create"
                                            onClick={handleCreate}
                                        >
                                            ✓ Scherm Toevoegen
                                        </button>
                                    </div>
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

                            {/* Edit Screen Modal */}
                            {editingId && (
                                <div className="screen-create-modal screen-edit-modal">
                                    <div className="modal-header">
                                        <h3>✏️ Scherm Bewerken</h3>
                                        <span className="edit-screen-id">ID: {editingId}</span>
                                    </div>

                                    <div className="modal-content">
                                        {/* Basic Info Section */}
                                        <div className="form-section">
                                            <h4>Basis Informatie</h4>
                                            <div className="form-group">
                                                <label htmlFor="edit-screen-name">Schermnaam</label>
                                                <input
                                                    id="edit-screen-name"
                                                    type="text"
                                                    placeholder="bijv. Lobby Display 1"
                                                    value={formData.name || ""}
                                                    onChange={e => handleInputChange("name", e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Position & Size Section */}
                                        <div className="form-section">
                                            <h4>Positie & Afmetingen</h4>
                                            <p className="section-help">Positie in pixels binnen het 1920×1080 canvas</p>
                                            <div className="form-grid-2x2">
                                                <div className="form-group">
                                                    <label htmlFor="edit-screen-x">X Positie</label>
                                                    <input
                                                        id="edit-screen-x"
                                                        type="number"
                                                        value={formData.x || 0}
                                                        onChange={e => handleInputChange("x", parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label htmlFor="edit-screen-y">Y Positie</label>
                                                    <input
                                                        id="edit-screen-y"
                                                        type="number"
                                                        value={formData.y || 0}
                                                        onChange={e => handleInputChange("y", parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label htmlFor="edit-screen-width">Breedte (px)</label>
                                                    <input
                                                        id="edit-screen-width"
                                                        type="number"
                                                        value={formData.width || 0}
                                                        onChange={e => handleInputChange("width", parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label htmlFor="edit-screen-height">Hoogte (px)</label>
                                                    <input
                                                        id="edit-screen-height"
                                                        type="number"
                                                        value={formData.height || 0}
                                                        onChange={e => handleInputChange("height", parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Location Section */}
                                        <div className="form-section">
                                            <h4>Fysieke Locatie</h4>
                                            <p className="section-help">Optioneel: voor weergave op de kaart</p>

                                            <div className="location-mode-toggle">
                                                <button
                                                    type="button"
                                                    className={`mode-btn ${editLocationMode === "address" ? "active" : ""}`}
                                                    onClick={() => setEditLocationMode("address")}
                                                >
                                                    📮 Adres Invoeren
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`mode-btn ${editLocationMode === "coords" ? "active" : ""}`}
                                                    onClick={() => setEditLocationMode("coords")}
                                                >
                                                    🌐 Coördinaten
                                                </button>
                                            </div>

                                            {editLocationMode === "address" ? (
                                                <div className="location-address-form">
                                                    <div className="form-row-inline">
                                                        <div className="form-group flex-1">
                                                            <label htmlFor="edit-screen-postcode">Postcode</label>
                                                            <input
                                                                id="edit-screen-postcode"
                                                                type="text"
                                                                placeholder="1234AB"
                                                                value={editPostcode}
                                                                onChange={e => setEditPostcode(e.target.value.toUpperCase())}
                                                                maxLength={7}
                                                                className="input-uppercase"
                                                            />
                                                        </div>
                                                        <div className="form-group flex-half">
                                                            <label htmlFor="edit-screen-huisnummer">Huisnr.</label>
                                                            <input
                                                                id="edit-screen-huisnummer"
                                                                type="text"
                                                                placeholder="123"
                                                                value={editHuisnummer}
                                                                onChange={e => setEditHuisnummer(e.target.value)}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn-geocode"
                                                            onClick={() => handleGeocode(`${editPostcode} ${editHuisnummer}`, true)}
                                                            disabled={!editPostcode || !editHuisnummer}
                                                        >
                                                            📍 Zoek
                                                        </button>
                                                    </div>
                                                    {formData.address && (
                                                        <div className="location-result">
                                                            <span className="result-icon">✓</span>
                                                            <span className="result-text">{formData.address}</span>
                                                        </div>
                                                    )}
                                                    {!formData.address && formData.lat && formData.lat !== 0 && (
                                                        <div className="location-result coords">
                                                            <span>📍 {formData.lat?.toFixed(5)}, {formData.lng?.toFixed(5)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="location-coords-form">
                                                    <div className="form-row-inline">
                                                        <div className="form-group flex-1">
                                                            <label htmlFor="edit-screen-lat">Latitude</label>
                                                            <input
                                                                id="edit-screen-lat"
                                                                type="number"
                                                                step="0.000001"
                                                                placeholder="52.12345"
                                                                value={formData.lat || ""}
                                                                onChange={e => handleInputChange("lat", parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                        <div className="form-group flex-1">
                                                            <label htmlFor="edit-screen-lng">Longitude</label>
                                                            <input
                                                                id="edit-screen-lng"
                                                                type="number"
                                                                step="0.000001"
                                                                placeholder="4.12345"
                                                                value={formData.lng || ""}
                                                                onChange={e => handleInputChange("lng", parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="modal-footer">
                                        <button
                                            type="button"
                                            className="btn-danger"
                                            onClick={() => showDeleteScreenConfirm(editingId, formData.name || editingId)}
                                        >
                                            🗑️ Verwijderen
                                        </button>
                                        <div className="footer-right">
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() => setEditingId(null)}
                                            >
                                                Annuleren
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-primary btn-save-edit"
                                                onClick={handleSave}
                                            >
                                                ✓ Opslaan
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                        <tr
                                            key={screen.id}
                                            onClick={() => handleEdit(screen)}
                                            className={editingId === screen.id ? "selected-row" : ""}
                                        >
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
                                                    className="btn-icon btn-edit"
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(screen); }}
                                                    title="Bewerken"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="btn-icon btn-delete"
                                                    onClick={(e) => { e.stopPropagation(); showDeleteScreenConfirm(screen.id, screen.name || screen.id); }}
                                                    title="Verwijderen"
                                                >
                                                    x
                                                </button>
                                            </td>
                                        </tr>
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

            {/* Delete Confirmation Modal */}
            {deleteConfirm?.show && (
                <div className="confirm-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon">⚠️</div>
                        <h3>Verwijderen bevestigen</h3>
                        <p>
                            Weet je zeker dat je {deleteConfirm.type === "display" ? "display" : "scherm"}{" "}
                            <strong>"{deleteConfirm.name}"</strong> wilt verwijderen?
                        </p>
                        {deleteConfirm.type === "display" && (
                            <p className="confirm-warning">
                                ⚠️ Alle schermen in deze display worden ook verwijderd!
                            </p>
                        )}
                        <div className="confirm-buttons">
                            <button
                                className="btn-secondary"
                                onClick={() => setDeleteConfirm(null)}
                            >
                                Annuleren
                            </button>
                            <button
                                className="btn-danger"
                                onClick={handleConfirmDelete}
                            >
                                Verwijderen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
