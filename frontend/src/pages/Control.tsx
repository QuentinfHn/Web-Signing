import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { trpcClient, Preset, Content, Screen, Scenario, Display } from "../utils/trpc";
import { useWebSocket, ScreenState } from "../utils/websocket";
import AdvancedContentSelector from "../components/AdvancedContentSelector";

// Scenarios are now fetched from DB

type ScenarioAssignments = Record<string, Record<string, string>>;

interface PresetModalProps {
    preset?: Preset;
    screens: Screen[];
    displays: Display[];
    scenarios: string[];
    onSave: (name: string, scenarioMappings: Record<string, string>) => void;
    onClose: () => void;
}

const PresetModal = ({ preset, screens, displays, scenarios, onSave, onClose }: PresetModalProps) => {
    const [name, setName] = useState(preset?.name || "");
    const [scenarioMappings, setScenarioMappings] = useState<Record<string, string>>(
        preset?.scenarios || {}
    );

    const handleScenarioChange = (screenId: string, scenario: string) => {
        setScenarioMappings(prev => {
            if (scenario === "") {
                const { [screenId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [screenId]: scenario };
        });
    };

    const handleSave = () => {
        if (!name.trim()) {
            alert("Voer een naam in");
            return;
        }
        onSave(name.trim(), scenarioMappings);
    };

    // Group screens by displayId
    const screensByDisplay = screens.reduce<Record<string, Screen[]>>((acc, screen) => {
        if (!acc[screen.displayId]) {
            acc[screen.displayId] = [];
        }
        acc[screen.displayId].push(screen);
        return acc;
    }, {});

    const getDisplayName = (displayId: string): string => {
        const display = displays.find(d => d.id === displayId);
        return display?.name || displayId;
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content preset-modal">
                <h3>{preset ? "Preset Bewerken" : "Nieuwe Preset"}</h3>
                <div className="form-group">
                    <label>Naam:</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="modal-input"
                        placeholder="Preset naam"
                        autoFocus
                    />
                </div>
                <div className="form-group">
                    <label>Scenario per scherm:</label>
                    <div className="preset-screens-grid">
                        {Object.entries(screensByDisplay).map(([displayId, displayScreens]) => (
                            <div key={displayId} className="preset-display-group">
                                <div className="preset-display-header">
                                    {getDisplayName(displayId)}
                                </div>
                                {displayScreens.map((screen) => (
                                    <div key={screen.id} className="preset-screen-row">
                                        <span className="preset-screen-name">{screen.name || screen.id}</span>
                                        <select
                                            value={scenarioMappings[screen.id] || ""}
                                            onChange={(e) => handleScenarioChange(screen.id, e.target.value)}
                                            className="modal-select"
                                        >
                                            <option value="">-- Geen --</option>
                                            {scenarios.map((scenario) => (
                                                <option key={scenario} value={scenario}>
                                                    {scenario}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="modal-actions">
                    <button onClick={onClose} className="btn-secondary">Annuleren</button>
                    <button onClick={handleSave} className="btn-primary">Opslaan</button>
                </div>
            </div>
        </div>
    );
};

interface SceneSettingsModalProps {
    scenarioName: string;
    currentPath: string | undefined;
    contentLibrary: Content[];
    onSave: (newName: string, newPath: string) => void;
    onClose: () => void;
    onContentUpdate: (updatedContent: Content) => void;
}

const SceneSettingsModal = ({ scenarioName, currentPath, contentLibrary, onSave, onClose, onContentUpdate }: SceneSettingsModalProps) => {
    const [name, setName] = useState(scenarioName);
    const [path, setPath] = useState(currentPath || "");

    return (
        <div className="modal-overlay">
            <div className="modal-content modal-content-wide">
                <h3>Instellingen voor {scenarioName}</h3>
                <div className="form-group">
                    <label>Naam:</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="modal-input"
                    />
                </div>
                <div className="form-group">
                    <label>Content:</label>
                    <AdvancedContentSelector
                        value={path}
                        onChange={setPath}
                        contentLibrary={contentLibrary}
                        onContentUpdate={onContentUpdate}
                    />
                </div>
                <div className="modal-actions">
                    <button onClick={onClose} className="btn-secondary">Annuleren</button>
                    <button onClick={() => onSave(name, path)} className="btn-primary">Opslaan</button>
                </div>
            </div>
        </div>
    );
};

export default function Control() {
    const [screenStates, setScreenStates] = useState<ScreenState>({});
    const [presets, setPresets] = useState<Preset[]>([]);
    const [scenarioAssignments, setScenarioAssignments] = useState<ScenarioAssignments>({});
    const [contentLibrary, setContentLibrary] = useState<Content[]>([]);
    const [screens, setScreens] = useState<Screen[]>([]);
    const [scenarios, setScenarios] = useState<string[]>([]);
    const [displays, setDisplays] = useState<Display[]>([]);

    // State for scene settings modal
    const [editingState, setEditingState] = useState<{
        screenId: string;
        scenario: string;
    } | null>(null);

    // State for preset modal
    const [presetModal, setPresetModal] = useState<{
        mode: "create" | "edit";
        preset?: Preset;
    } | null>(null);

    const handleStateUpdate = useCallback((state: ScreenState) => {
        setScreenStates(state);
    }, []);

    const { connected, setImage } = useWebSocket(handleStateUpdate);

    // Fetch data on mount
    useEffect(() => {
        trpcClient.presets.list.query().then(setPresets).catch(console.error);
        trpcClient.scenarios.getAll.query().then(setScenarioAssignments).catch(console.error);
        trpcClient.content.list.query({}).then(setContentLibrary).catch(console.error);
        trpcClient.screens.list.query().then(setScreens).catch(console.error);
        trpcClient.displays.list.query().then(setDisplays).catch(console.error);

        // Fetch persistent scenario names from DB
        trpcClient.scenarioNames.list.query().then(scenarioList => {
            if (scenarioList.length === 0) {
                // Seed defaults if none exist
                trpcClient.scenarioNames.seedDefaults.mutate().then(() => {
                    trpcClient.scenarioNames.list.query().then((s: Scenario[]) => setScenarios(s.map((sc: Scenario) => sc.name)));
                });
            } else {
                setScenarios(scenarioList.map((s: Scenario) => s.name));
            }
        }).catch(console.error);
    }, []);

    const handleRadioChange = (screenId: string, src: string) => {
        setImage(screenId, src);
    };

    const handlePresetClick = async (preset: Preset) => {
        try {
            await trpcClient.presets.activate.mutate({ presetId: preset.id });
        } catch (error) {
            console.error("Failed to activate preset:", error);
            alert("Activeren mislukt: " + (error instanceof Error ? error.message : "Onbekende fout"));
        }
    };

    const handleCreatePreset = async (name: string, scenarios: Record<string, string>) => {
        try {
            const newPreset = await trpcClient.presets.create.mutate({ name, scenarios });
            setPresets(prev => [...prev, newPreset]);
            setPresetModal(null);
        } catch (error) {
            console.error("Failed to create preset:", error);
            alert("Aanmaken mislukt: " + (error instanceof Error ? error.message : "Onbekende fout"));
        }
    };

    const handleUpdatePreset = async (name: string, scenarios: Record<string, string>) => {
        if (!presetModal?.preset) return;
        try {
            const updated = await trpcClient.presets.update.mutate({
                id: presetModal.preset.id,
                name,
                scenarios,
            });
            setPresets(prev => prev.map(p => p.id === updated.id ? updated : p));
            setPresetModal(null);
        } catch (error) {
            console.error("Failed to update preset:", error);
            alert("Bijwerken mislukt: " + (error instanceof Error ? error.message : "Onbekende fout"));
        }
    };

    const handleDeletePreset = async (preset: Preset) => {
        if (!confirm(`Weet je zeker dat je "${preset.name}" wilt verwijderen?`)) return;
        try {
            await trpcClient.presets.delete.mutate({ id: preset.id });
            setPresets(prev => prev.filter(p => p.id !== preset.id));
        } catch (error) {
            console.error("Failed to delete preset:", error);
            alert("Verwijderen mislukt: " + (error instanceof Error ? error.message : "Onbekende fout"));
        }
    };

    const handleSaveSettings = async (screenId: string, oldScenarioName: string, newName: string, newPath: string) => {
        try {
            // 1. Handle Rename if changed
            if (newName && newName.trim() !== oldScenarioName) {
                await trpcClient.scenarioNames.rename.mutate({ oldName: oldScenarioName, newName });
                setScenarios(prev => prev.map(s => s === oldScenarioName ? newName : s));

                // Update local assignments key
                setScenarioAssignments(prev => {
                    const updated: ScenarioAssignments = {};
                    Object.entries(prev).forEach(([sId, assignments]) => {
                        updated[sId] = {};
                        Object.entries(assignments).forEach(([sc, path]) => {
                            const key = sc === oldScenarioName ? newName : sc;
                            updated[sId][key] = path;
                        });
                    });
                    return updated;
                });
            }

            // 2. Handle Content Assignment
            // Use the NEW name if we renamed it, otherwise the old name
            const targetScenarioName = (newName && newName.trim() !== oldScenarioName) ? newName : oldScenarioName;

            await trpcClient.scenarios.set.mutate({ screenId, scenario: targetScenarioName, imagePath: newPath });

            setScenarioAssignments(prev => ({
                ...prev,
                [screenId]: {
                    ...prev[screenId],
                    [targetScenarioName]: newPath
                }
            }));

            setEditingState(null);
        } catch (error) {
            console.error("Failed to save settings:", error);
            alert("Opslaan mislukt: " + (error instanceof Error ? error.message : "Onbekende fout"));
        }
    };

    const handleRowClick = (screenId: string, imagePath: string | undefined) => {
        if (imagePath) {
            handleRadioChange(screenId, imagePath);
        }
    };

    const getScenarioPath = (screenId: string, scenario: string): string | undefined => {
        return scenarioAssignments[screenId]?.[scenario];
    };

    const getDisplayName = (displayId: string): string => {
        const display = displays.find(d => d.id === displayId);
        return display?.name || displayId;
    };

    // Group screens by displayId
    const screensByDisplay = screens.reduce<Record<string, Screen[]>>((acc, screen) => {
        if (!acc[screen.displayId]) {
            acc[screen.displayId] = [];
        }
        acc[screen.displayId].push(screen);
        return acc;
    }, {});

    return (
        <div className="control-page">
            <header>
                <h1>Control Panel</h1>
                <div className="header-actions">
                    <span className={`connection-status ${connected ? "connected" : "disconnected"}`}>
                        {connected ? "Verbonden" : "Niet verbonden"}
                    </span>
                    <Link to="/" className="back-link">Terug</Link>
                </div>
            </header>

            {Object.entries(screensByDisplay).map(([displayId, displayScreens]) => (
                <section key={displayId} className="control-section">
                    <h2>📺 {getDisplayName(displayId)}</h2>
                    <div className="screens-grid">
                        {displayScreens.map((screen) => (
                            <div key={screen.id} className="screen-card">
                                <h3>{screen.name || screen.id}</h3>
                                <div className="radio-group">
                                    {/* Uit optie om scherm leeg te maken */}
                                    <div className="scenario-row">
                                        <div className="radio-option">
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name={screen.id}
                                                    value=""
                                                    checked={!screenStates[screen.id]?.src}
                                                    onChange={() => handleRadioChange(screen.id, "")}
                                                />
                                                <span className="scenario-name scenario-off">⭘ Uit</span>
                                            </label>
                                        </div>
                                    </div>
                                    {scenarios.map((scenario) => {
                                        const imagePath = getScenarioPath(screen.id, scenario);
                                        const isSelected = !!imagePath && screenStates[screen.id]?.src === imagePath;

                                        return (
                                            <div key={scenario} className="scenario-row">
                                                <div
                                                    className={`radio-option clickable-row ${isSelected ? 'selected' : ''} ${!imagePath ? 'disabled' : ''}`}
                                                    onClick={() => handleRowClick(screen.id, imagePath)}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={screen.id}
                                                        value={imagePath || ""}
                                                        checked={isSelected}
                                                        onChange={() => { }}
                                                        disabled={!imagePath}
                                                    />
                                                    <span className="scenario-name">{scenario}</span>

                                                    {imagePath && (
                                                        <span className="assigned-content-indicator">
                                                            ✓
                                                        </span>
                                                    )}

                                                    <button
                                                        className="settings-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingState({ screenId: screen.id, scenario });
                                                        }}
                                                        title="Instellingen"
                                                    >
                                                        ⚙️
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            <section className="control-section">
                <div className="section-header">
                    <h2>🎬 Presets</h2>
                    <button
                        className="btn-primary btn-small"
                        onClick={() => setPresetModal({ mode: "create" })}
                    >
                        + Nieuw
                    </button>
                </div>
                <div className="presets-container">
                    {presets.map((preset) => (
                        <div key={preset.id} className="preset-item">
                            <button
                                className="preset-button"
                                onClick={() => handlePresetClick(preset)}
                            >
                                {preset.name}
                            </button>
                            <div className="preset-actions">
                                <button
                                    className="btn-icon btn-edit"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPresetModal({ mode: "edit", preset });
                                    }}
                                    title="Bewerken"
                                >
                                    ✏️
                                </button>
                                <button
                                    className="btn-icon btn-delete"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePreset(preset);
                                    }}
                                    title="Verwijderen"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                    {presets.length === 0 && (
                        <p className="empty-message-inline">Geen presets. Maak er een aan!</p>
                    )}
                </div>
            </section>

            {/* Scene Settings Modal */}
            {editingState && (
                <SceneSettingsModal
                    scenarioName={editingState.scenario}
                    currentPath={getScenarioPath(editingState.screenId, editingState.scenario)}
                    contentLibrary={contentLibrary}
                    onSave={(newName, newPath) => handleSaveSettings(editingState.screenId, editingState.scenario, newName, newPath)}
                    onClose={() => setEditingState(null)}
                    onContentUpdate={(updatedContent) => {
                        setContentLibrary(prev =>
                            prev.map(c => c.id === updatedContent.id ? updatedContent : c)
                        );
                    }}
                />
            )}

            {/* Preset Modal */}
            {presetModal && (
                <PresetModal
                    preset={presetModal.preset}
                    screens={screens}
                    displays={displays}
                    scenarios={scenarios}
                    onSave={presetModal.mode === "create" ? handleCreatePreset : handleUpdatePreset}
                    onClose={() => setPresetModal(null)}
                />
            )}
        </div>
    );
}
