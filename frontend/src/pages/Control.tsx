import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { trpcClient, Preset, Content, Screen } from "../utils/trpc";
import { useWebSocket, ScreenState } from "../utils/websocket";

const DEFAULT_SCENARIOS = ["Test", "Scene 1", "Scene 2", "Scene 3"];

type ScenarioAssignments = Record<string, Record<string, string>>;

export default function Control() {
    const [screenStates, setScreenStates] = useState<ScreenState>({});
    const [presets, setPresets] = useState<Preset[]>([]);
    const [scenarioAssignments, setScenarioAssignments] = useState<ScenarioAssignments>({});
    const [contentLibrary, setContentLibrary] = useState<Content[]>([]);
    const [editingScreen, setEditingScreen] = useState<string | null>(null);
    const [editingScenario, setEditingScenario] = useState<string | null>(null);
    const [screens, setScreens] = useState<Screen[]>([]);
    const [scenarios, setScenarios] = useState<string[]>(DEFAULT_SCENARIOS);
    const [renamingScenario, setRenamingScenario] = useState<string | null>(null);
    const [newScenarioName, setNewScenarioName] = useState<string>("");

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
    }, []);

    const handleRadioChange = (screenId: string, src: string) => {
        setImage(screenId, src);
    };

    const handlePresetClick = (preset: Preset) => {
        Object.entries(preset.screens).forEach(([screenId, src]) => {
            if (typeof src === 'string') {
                setImage(screenId, src);
            }
        });
    };

    const handleAssignContent = async (screenId: string, scenario: string, imagePath: string) => {
        try {
             
            await trpcClient.scenarios.set.mutate({ screenId, scenario, imagePath });

            // Update local state
            setScenarioAssignments(prev => ({
                ...prev,
                [screenId]: {
                    ...prev[screenId],
                    [scenario]: imagePath
                }
            }));

            setEditingScreen(null);
            setEditingScenario(null);
        } catch (error) {
            console.error("Failed to assign content:", error);
        }
    };

    const handleRenameScenario = (oldName: string, newName: string) => {
        if (!newName.trim() || newName === oldName) {
            setRenamingScenario(null);
            setNewScenarioName("");
            return;
        }

        // Update scenarios list
        setScenarios(prev => prev.map(s => s === oldName ? newName : s));

        // Update scenario assignments to use new name
        setScenarioAssignments(prev => {
            const updated: ScenarioAssignments = {};
            Object.entries(prev).forEach(([screenId, assignments]) => {
                updated[screenId] = {};
                Object.entries(assignments).forEach(([scenario, path]) => {
                    const key = scenario === oldName ? newName : scenario;
                    updated[screenId][key] = path;
                });
            });
            return updated;
        });

        // Persist to backend for each screen
        Object.entries(scenarioAssignments).forEach(([screenId, assignments]) => {
            const imagePath = assignments[oldName];
            if (imagePath) {
                // Remove old scenario assignment and add new one
                 
                trpcClient.scenarios.set.mutate({ screenId, scenario: newName, imagePath }).catch(console.error);
            }
        });

        setRenamingScenario(null);
        setNewScenarioName("");
    };

    const handleRowClick = (screenId: string, imagePath: string | undefined) => {
        if (imagePath) {
            handleRadioChange(screenId, imagePath);
        }
    };

    const platielPresets = presets.filter((p) =>
        p.name.toLowerCase().includes("platielstraat")
    );
    const koestraatPresets = presets.filter((p) =>
        p.name.toLowerCase().includes("koestraat")
    );

    const getScenarioPath = (screenId: string, scenario: string): string | undefined => {
        return scenarioAssignments[screenId]?.[scenario];
    };

    // Group screens by displayId
    const screensByDisplay = screens.reduce((acc, screen) => {
        if (!acc[screen.displayId]) {
            acc[screen.displayId] = [];
        }
        acc[screen.displayId].push(screen);
        return acc;
    }, {} as Record<string, Screen[]>);

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
                    <h2>📺 {displayId}</h2>
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
                                        const isEditing = editingScreen === screen.id && editingScenario === scenario;
                                        const isRenaming = renamingScenario === scenario;
                                        const isSelected = !!imagePath && screenStates[screen.id]?.src === imagePath;

                                        return (
                                            <div key={scenario} className="scenario-row">
                                                {isEditing ? (
                                                    <div className="content-picker">
                                                        <span className="scenario-label">{scenario}:</span>
                                                        <select
                                                            autoFocus
                                                            value={imagePath || ""}
                                                            onChange={(e) => handleAssignContent(screen.id, scenario, e.target.value)}
                                                            onBlur={() => {
                                                                setEditingScreen(null);
                                                                setEditingScenario(null);
                                                            }}
                                                        >
                                                            <option value="">-- Kies content --</option>
                                                            {contentLibrary.map((c) => (
                                                                <option key={c.id} value={c.path}>
                                                                    {c.filename}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
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
                                                        {isRenaming ? (
                                                            <input
                                                                type="text"
                                                                className="scenario-rename-input"
                                                                value={newScenarioName}
                                                                onChange={(e) => setNewScenarioName(e.target.value)}
                                                                onBlur={() => handleRenameScenario(scenario, newScenarioName)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleRenameScenario(scenario, newScenarioName);
                                                                    } else if (e.key === 'Escape') {
                                                                        setRenamingScenario(null);
                                                                        setNewScenarioName("");
                                                                    }
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <span className="scenario-name">{scenario}</span>
                                                        )}
                                                        <button
                                                            className="rename-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRenamingScenario(scenario);
                                                                setNewScenarioName(scenario);
                                                            }}
                                                            title="Hernoem scene"
                                                        >
                                                            ✎
                                                        </button>
                                                        <button
                                                            className="edit-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingScreen(screen.id);
                                                                setEditingScenario(scenario);
                                                            }}
                                                            title="Wijzig content"
                                                        >
                                                            ✏️
                                                        </button>
                                                        {imagePath && (
                                                            <span className="assigned-content" title={imagePath}>
                                                                ✓
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
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
                <h2>🎬 Platielstraat Presets</h2>
                <div className="presets-container">
                    {platielPresets.map((preset) => (
                        <button
                            key={preset.id}
                            className="preset-button"
                            onClick={() => handlePresetClick(preset)}
                        >
                            {preset.name.replace("Platielstraat – ", "")}
                        </button>
                    ))}
                </div>
            </section>

            <section className="control-section">
                <h2>🎬 Koestraat Presets</h2>
                <div className="presets-container">
                    {koestraatPresets.map((preset) => (
                        <button
                            key={preset.id}
                            className="preset-button"
                            onClick={() => handlePresetClick(preset)}
                        >
                            {preset.name.replace("Koestraat – ", "")}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
