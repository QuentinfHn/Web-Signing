import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { trpcClient, Preset, Content, Screen, Scenario, Display } from "../utils/trpc";
import { useWebSocket, ScreenState, VnnoxStatusData } from "../utils/websocket";
import { sortScreensByName } from "../utils/sorting";
import AdvancedContentSelector from "../components/AdvancedContentSelector";
import styles from "./Control.module.css";
import buttonStyles from "../components/Button.module.css";
import formStyles from "../components/Form.module.css";
import modalStyles from "../components/Modal.module.css";
import slideshowStyles from "../components/SlideshowEditor.module.css";


// Scenarios are now fetched from DB

interface ScenarioData {
    imagePath: string;
    intervalMs: number | null;
    images: string[];
}

type ScenarioAssignments = Record<string, Record<string, ScenarioData>>;

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

    // Reset state when preset changes (switching between create/edit or different presets)
    useEffect(() => {
        setName(preset?.name || "");
        setScenarioMappings(preset?.scenarios || {});
    }, [preset?.id]);

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

    // Group screens by displayId and sort by name
    const screensByDisplay = Object.fromEntries(
        Object.entries(
            screens.reduce<Record<string, Screen[]>>((acc, screen) => {
                if (!acc[screen.displayId]) {
                    acc[screen.displayId] = [];
                }
                acc[screen.displayId].push(screen);
                return acc;
            }, {})
        ).map(([displayId, displayScreens]) => [displayId, sortScreensByName(displayScreens)])
    );

    const getDisplayName = (displayId: string): string => {
        const display = displays.find(d => d.id === displayId);
        return display?.name || displayId;
    };

    return (
        <div className={modalStyles.modalOverlay}>
            <div className={`${modalStyles.modalContent} ${styles.presetModal}`}>
                <h3>{preset ? "Preset Bewerken" : "Nieuwe Preset"}</h3>
                <div className={formStyles.formGroup}>
                    <label>Naam:</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={formStyles.modalInput}
                        placeholder="Preset naam"
                        autoFocus
                    />
                </div>
                <div className={formStyles.formGroup}>
                    <label>Scenario per scherm:</label>
                    <div className={styles.presetScreensGrid}>
                        {Object.entries(screensByDisplay).map(([displayId, displayScreens]) => (
                            <div key={displayId} className={styles.presetDisplayGroup}>
                                <div className={styles.presetDisplayHeader}>
                                    {getDisplayName(displayId)}
                                </div>
                                {displayScreens.map((screen) => (
                                    <div key={screen.id} className={styles.presetScreenRow}>
                                        <span className={styles.presetScreenName}>{screen.name || screen.id}</span>
                                        <select
                                            value={scenarioMappings[screen.id] || ""}
                                            onChange={(e) => handleScenarioChange(screen.id, e.target.value)}
                                            className={formStyles.modalSelect}
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
                <div className={modalStyles.modalActions}>
                    <button onClick={onClose} className={buttonStyles.btnSecondary}>Annuleren</button>
                    <button onClick={handleSave} className={buttonStyles.btnPrimary}>Opslaan</button>
                </div>
            </div>
        </div>
    );
};

interface SlideshowEditorProps {
    images: string[];
    intervalMs: number | null;
    contentLibrary: Content[];
    onImagesChange: (images: string[]) => void;
    onIntervalChange: (intervalMs: number | null) => void;
    onContentUpdate: (updatedContent: Content) => void;
}

const SlideshowEditor = ({ images, intervalMs, contentLibrary, onImagesChange, onIntervalChange, onContentUpdate }: SlideshowEditorProps) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [intervalInput, setIntervalInput] = useState<string>(
        intervalMs ? String(Math.round(intervalMs / 1000)) : "5"
    );

    // Sync intervalInput when intervalMs prop changes
    useEffect(() => {
        setIntervalInput(intervalMs ? String(Math.round(intervalMs / 1000)) : "5");
    }, [intervalMs]);

    const getContentByPath = (path: string): Content | undefined => {
        return contentLibrary.find(c => c.path === path);
    };

    const handleAddImage = (path: string) => {
        if (path && !images.includes(path)) {
            onImagesChange([...images, path]);
        }
        setShowAddModal(false);
    };

    const handleRemoveImage = (index: number) => {
        const newImages = images.filter((_, i) => i !== index);
        onImagesChange(newImages);
        // Clear interval if only one image left
        if (newImages.length <= 1) {
            onIntervalChange(null);
        }
    };

    const handleClearAll = () => {
        onImagesChange([]);
        onIntervalChange(null);
    };

    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        const newImages = [...images];
        [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
        onImagesChange(newImages);
    };

    const handleMoveDown = (index: number) => {
        if (index === images.length - 1) return;
        const newImages = [...images];
        [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
        onImagesChange(newImages);
    };

    const handleIntervalInputChange = (value: string) => {
        // Only allow digits
        if (value === "" || /^\d+$/.test(value)) {
            setIntervalInput(value);
            if (value === "") {
                onIntervalChange(null);
            } else {
                const seconds = parseInt(value);
                if (!isNaN(seconds) && seconds >= 1) {
                    onIntervalChange(seconds * 1000);
                }
            }
        }
    };

    return (
        <div className={slideshowStyles.slideshowEditor}>
            <div className={slideshowStyles.slideshowImagesList}>
                {images.length === 0 ? (
                    <div className={slideshowStyles.slideshowEmpty}>Geen afbeeldingen. Voeg er een toe.</div>
                ) : (
                    images.map((path, index) => {
                        const content = getContentByPath(path);
                        return (
                            <div key={`${path}-${index}`} className={slideshowStyles.slideshowImageItem}>
                                <span className={slideshowStyles.slideshowOrder}>{index + 1}</span>
                                <span className={slideshowStyles.slideshowFilename}>
                                    {content?.filename || path.split('/').pop()}
                                </span>
                                <div className={slideshowStyles.slideshowItemActions}>
                                    <button
                                        type="button"
                                        onClick={() => handleMoveUp(index)}
                                        disabled={index === 0}
                                        className={buttonStyles.btnIcon}
                                        title="Omhoog"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleMoveDown(index)}
                                        disabled={index === images.length - 1}
                                        className={buttonStyles.btnIcon}
                                        title="Omlaag"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImage(index)}
                                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnDelete}`}
                                        title="Verwijderen"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className={slideshowStyles.slideshowActions}>
                <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className={`${buttonStyles.btnSecondary} ${buttonStyles.btnSmall}`}
                >
                    + Afbeelding toevoegen
                </button>
                {images.length > 0 && (
                    <button
                        type="button"
                        onClick={handleClearAll}
                        className={`${buttonStyles.btnSecondary} ${buttonStyles.btnSmall} ${buttonStyles.btnClear}`}
                    >
                        Wis alles
                    </button>
                )}
            </div>

            {images.length > 1 && (
                <div className={slideshowStyles.slideshowInterval}>
                    <label>Interval (seconden):</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={intervalInput}
                        onChange={(e) => handleIntervalInputChange(e.target.value)}
                        className={formStyles.intervalInput}
                    />
                </div>
            )}

            {showAddModal && (
                <div className={slideshowStyles.slideshowAddModal}>
                    <div className={slideshowStyles.slideshowAddContent}>
                        <h4>Afbeelding selecteren</h4>
                        <AdvancedContentSelector
                            value=""
                            onChange={handleAddImage}
                            contentLibrary={contentLibrary.filter(c => !images.includes(c.path))}
                            onContentUpdate={onContentUpdate}
                        />
                        <button
                            type="button"
                            onClick={() => setShowAddModal(false)}
                            className={buttonStyles.btnSecondary}
                        >
                            Annuleren
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

interface SceneSettingsModalProps {
    scenarioName: string;
    currentData: ScenarioData | undefined;
    contentLibrary: Content[];
    onSave: (newName: string, images: string[], intervalMs: number | null) => void;
    onClose: () => void;
    onContentUpdate: (updatedContent: Content) => void;
}

const SceneSettingsModal = ({ scenarioName, currentData, contentLibrary, onSave, onClose, onContentUpdate }: SceneSettingsModalProps) => {
    const [name, setName] = useState(scenarioName);
    const [images, setImages] = useState<string[]>(() => {
        if (currentData?.images && currentData.images.length > 0) {
            return currentData.images;
        }
        if (currentData?.imagePath) {
            return [currentData.imagePath];
        }
        return [];
    });
    const [intervalMs, setIntervalMs] = useState<number | null>(currentData?.intervalMs ?? 5000);

    const handleSave = () => {
        // Default to 5000ms if interval is empty/null
        const finalInterval = images.length > 1 ? (intervalMs || 5000) : null;
        onSave(name, images, finalInterval);
    };

    return (
        <div className={modalStyles.modalOverlay}>
            <div className={`${modalStyles.modalContent} ${modalStyles.modalContentWide}`}>
                <h3>Instellingen voor {scenarioName}</h3>
                <div className={formStyles.formGroup}>
                    <label>Naam:</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={formStyles.modalInput}
                    />
                </div>
                <div className={formStyles.formGroup}>
                    <label>Slideshow afbeeldingen:</label>
                    <SlideshowEditor
                        images={images}
                        intervalMs={intervalMs}
                        contentLibrary={contentLibrary}
                        onImagesChange={setImages}
                        onIntervalChange={setIntervalMs}
                        onContentUpdate={onContentUpdate}
                    />
                </div>
                <div className={modalStyles.modalActions}>
                    <button onClick={onClose} className={buttonStyles.btnSecondary}>Annuleren</button>
                    <button onClick={handleSave} className={buttonStyles.btnPrimary}>Opslaan</button>
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
    const [vnnoxStatuses, setVnnoxStatuses] = useState<VnnoxStatusData>({});
    const [vnnoxEnabled, setVnnoxEnabled] = useState(false);

    // State for scene settings modal
    const [editingState, setEditingState] = useState<{
        screenId: string;
        scenario: string;
    } | null>(null);

    // State for preset modal
    const [presetModal, setPresetModal] = useState<{
        mode: "create" | "edit";
        preset?: Preset;
        timestamp?: number;
    } | null>(null);

    const handleStateUpdate = useCallback((state: ScreenState) => {
        setScreenStates(state);
    }, []);

    const handleVnnoxUpdate = useCallback((statuses: VnnoxStatusData) => {
        setVnnoxStatuses(prev => ({ ...prev, ...statuses }));
    }, []);

    const { connected, setImage } = useWebSocket(handleStateUpdate, handleVnnoxUpdate);

    // Fetch data on mount
    useEffect(() => {
        trpcClient.presets.list.query().then(setPresets).catch(console.error);
        trpcClient.scenarios.getAll.query().then(setScenarioAssignments).catch(console.error);
        trpcClient.content.list.query({}).then(setContentLibrary).catch(console.error);
        trpcClient.screens.list.query().then(setScreens).catch(console.error);
        trpcClient.displays.list.query().then(setDisplays).catch(console.error);

        // Fetch VNNOX status
        trpcClient.vnnox.isEnabled.query().then(r => {
            setVnnoxEnabled(r.enabled);
            if (r.enabled) {
                trpcClient.vnnox.getStatuses.query().then(statuses => {
                    const mapped: VnnoxStatusData = {};
                    for (const [screenId, s] of Object.entries(statuses)) {
                        mapped[screenId] = {
                            playerId: s.playerId,
                            playerName: s.playerName,
                            onlineStatus: s.onlineStatus,
                            lastSeen: s.lastSeen?.toString() || null,
                        };
                    }
                    setVnnoxStatuses(mapped);
                }).catch(console.error);
            }
        }).catch(console.error);

        // Fetch persistent scenario names from DB
        trpcClient.scenarioNames.list.query().then(async (scenarioList) => {
            if (scenarioList.length < 4) {
                // Top up defaults when a legacy setup has fewer than 4 scenarios.
                await trpcClient.scenarioNames.seedDefaults.mutate();
                const refreshedScenarios = await trpcClient.scenarioNames.list.query();
                setScenarios(refreshedScenarios.map((scenario: Scenario) => scenario.name));
                return;
            }
            setScenarios(scenarioList.map((scenario: Scenario) => scenario.name));
        }).catch(console.error);
    }, []);

    const handleRadioChange = (screenId: string, src: string, scenario?: string) => {
        setImage(screenId, src, scenario);
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

    const handleSaveSettings = async (screenId: string, oldScenarioName: string, newName: string, images: string[], intervalMs: number | null) => {
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
                        Object.entries(assignments).forEach(([sc, data]) => {
                            const key = sc === oldScenarioName ? newName : sc;
                            updated[sId][key] = data;
                        });
                    });
                    return updated;
                });
            }

            // Use the NEW name if we renamed it, otherwise the old name
            const targetScenarioName = (newName && newName.trim() !== oldScenarioName) ? newName : oldScenarioName;

            // 2. Handle Assignment - delete if no images, otherwise set slideshow
            if (images.length === 0) {
                // Delete the assignment
                try {
                    await trpcClient.scenarios.delete.mutate({
                        screenId,
                        scenario: targetScenarioName
                    });
                } catch {
                    // Assignment might not exist, that's fine
                }

                // Remove from local state
                setScenarioAssignments(prev => {
                    const screenAssignments = { ...prev[screenId] };
                    delete screenAssignments[targetScenarioName];
                    return {
                        ...prev,
                        [screenId]: screenAssignments
                    };
                });
            } else {
                // Set slideshow with images
                await trpcClient.scenarios.setSlideshow.mutate({
                    screenId,
                    scenario: targetScenarioName,
                    images,
                    intervalMs
                });

                setScenarioAssignments(prev => ({
                    ...prev,
                    [screenId]: {
                        ...prev[screenId],
                        [targetScenarioName]: {
                            imagePath: images[0],
                            intervalMs,
                            images
                        }
                    }
                }));
            }

            setEditingState(null);
        } catch (error) {
            console.error("Failed to save settings:", error);
            alert("Opslaan mislukt: " + (error instanceof Error ? error.message : "Onbekende fout"));
        }
    };

    const handleRowClick = (screenId: string, scenario: string, imagePath: string | undefined) => {
        if (imagePath) {
            handleRadioChange(screenId, imagePath, scenario);
        }
    };

    const getScenarioData = (screenId: string, scenario: string): ScenarioData | undefined => {
        return scenarioAssignments[screenId]?.[scenario];
    };

    const getDisplayName = (displayId: string): string => {
        const display = displays.find(d => d.id === displayId);
        return display?.name || displayId;
    };

    // Group screens by displayId and sort by name
    const screensByDisplay = Object.fromEntries(
        Object.entries(
            screens.reduce<Record<string, Screen[]>>((acc, screen) => {
                if (!acc[screen.displayId]) {
                    acc[screen.displayId] = [];
                }
                acc[screen.displayId].push(screen);
                return acc;
            }, {})
        ).map(([displayId, displayScreens]) => [displayId, sortScreensByName(displayScreens)])
    );

    return (
        <div className={styles.controlPage}>
            <header>
                <h1>Control Panel</h1>
                <div className={styles.headerActions}>
                    <span className={`${styles.connectionStatus} ${connected ? styles.connected : styles.disconnected}`}>
                        {connected ? "Verbonden" : "Niet verbonden"}
                    </span>
                    <Link to="/" className={buttonStyles.backLink}>Terug</Link>
                </div>
            </header>

            {Object.entries(screensByDisplay).map(([displayId, displayScreens]) => (
                <section key={displayId} className={styles.controlSection}>
                    <h2>📺 {getDisplayName(displayId)}</h2>
                    <div className={styles.screensGrid}>
                        {displayScreens.map((screen) => {

                            return (
                                <div key={screen.id} className={styles.screenCard}>
                                    <h3>{screen.name || screen.id}</h3>
                                    {vnnoxEnabled && (
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-secondary, #a0a0b0)',
                                            marginTop: '-0.3rem',
                                            marginBottom: '0.5rem'
                                        }}>
                                            {vnnoxStatuses[screen.id] ? (
                                                vnnoxStatuses[screen.id].onlineStatus === 1 ? (
                                                    <span style={{ color: '#22c55e' }}>● Online</span>
                                                ) : (
                                                    <>
                                                        <span style={{ color: '#ef4444' }}>● Offline</span>
                                                        {vnnoxStatuses[screen.id].lastSeen && (
                                                            <span> - Laatst: {new Date(vnnoxStatuses[screen.id].lastSeen!).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} {new Date(vnnoxStatuses[screen.id].lastSeen!).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        )}
                                                    </>
                                                )
                                            ) : (
                                                <span style={{ color: '#6b7280' }}>○ Niet gekoppeld</span>
                                            )}
                                        </div>
                                    )}
                                    <div className={styles.radioGroup}>
                                        {/* Uit optie om scherm leeg te maken */}
                                        <div className={styles.scenarioRow}>
                                            <div className={styles.radioOption}>
                                                <label className={styles.radioLabel}>
                                                    <input
                                                        type="radio"
                                                        name={screen.id}
                                                        value=""
                                                        checked={!screenStates[screen.id]?.scenario}
                                                        onChange={() => handleRadioChange(screen.id, "")}
                                                    />
                                                    <span className={`${styles.scenarioName} ${styles.scenarioOff}`}>⭘ Uit</span>
                                                </label>
                                            </div>
                                        </div>
                                        {scenarios.map((scenario) => {
                                            const scenarioData = getScenarioData(screen.id, scenario);
                                            const imagePath = scenarioData?.imagePath;
                                            const isSlideshow = scenarioData && scenarioData.images && scenarioData.images.length > 1;
                                            const isSelected = screenStates[screen.id]?.scenario === scenario;

                                            return (
                                                <div key={scenario} className={styles.scenarioRow}>
                                                    <div
                                                        className={`${styles.radioOption} ${styles.clickableRow} ${isSelected ? styles.selected : ''} ${!imagePath ? styles.disabled : ''}`}
                                                        onClick={() => handleRowClick(screen.id, scenario, imagePath)}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={screen.id}
                                                            value={imagePath || ""}
                                                            checked={isSelected}
                                                            onChange={() => { }}
                                                            disabled={!imagePath}
                                                        />
                                                        <span className={styles.scenarioName}>{scenario}</span>

                                                        {imagePath && (
                                                            <span className={styles.assignedContentIndicator} title={isSlideshow ? `Slideshow: ${scenarioData.images.length} afbeeldingen` : 'Enkele afbeelding'}>
                                                                {isSlideshow ? `🎬 ${scenarioData.images.length}` : '✓'}
                                                            </span>
                                                        )}

                                                        <button
                                                            className={styles.settingsBtn}
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
                            );
                        })}
                    </div>
                </section>
            ))}

            <section className={styles.controlSection}>
                <div className={styles.sectionHeader}>
                    <h2>🎬 Presets</h2>
                    <button
                        className={`${buttonStyles.btnPrimary} ${buttonStyles.btnSmall}`}
                        onClick={() => setPresetModal({ mode: "create", timestamp: Date.now() })}
                    >
                        + Nieuw
                    </button>
                </div>
                <div className={styles.presetsContainer}>
                    {presets.map((preset) => (
                        <div key={preset.id} className={styles.presetItem}>
                            <button
                                className={styles.presetButton}
                                onClick={() => handlePresetClick(preset)}
                            >
                                {preset.name}
                            </button>
                            <div className={styles.presetActions}>
                                <button
                                    className={`${buttonStyles.btnIcon} ${buttonStyles.btnEdit}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPresetModal({ mode: "edit", preset });
                                    }}
                                    title="Bewerken"
                                >
                                    ✏️
                                </button>
                                <button
                                    className={`${buttonStyles.btnIcon} ${buttonStyles.btnDelete}`}
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
                        <p className={styles.emptyMessageInline}>Geen presets. Maak er een aan!</p>
                    )}
                </div>
            </section>

            {/* Scene Settings Modal */}
            {editingState && (
                <SceneSettingsModal
                    scenarioName={editingState.scenario}
                    currentData={getScenarioData(editingState.screenId, editingState.scenario)}
                    contentLibrary={contentLibrary}
                    onSave={(newName, images, intervalMs) => handleSaveSettings(editingState.screenId, editingState.scenario, newName, images, intervalMs)}
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
                    key={presetModal.preset?.id || `new-${presetModal.timestamp}`}
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
