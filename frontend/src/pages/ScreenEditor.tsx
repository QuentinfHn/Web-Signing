import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { trpcClient, Screen } from "../utils/trpc";
import { ConflictMode, ImportResult } from "../types/screen";

import { DisplayList } from "../components/ScreenEditor/DisplayList";
import { ScreenCanvas } from "../components/ScreenEditor/ScreenCanvas";
import { ScreenProperties } from "../components/ScreenEditor/ScreenProperties";
import { ImportExport } from "../components/ScreenEditor/ImportExport";

import { useDisplays } from "../hooks/useDisplays";
import { useScreens } from "../hooks/useScreens";
import { useGeocode } from "../hooks/useGeocode";
import { useScreenEditor } from "../hooks/useScreenEditor";

import styles from "./ScreenEditor.module.css";
import buttonStyles from "../components/Button.module.css";
import modalStyles from "../components/Modal.module.css";
import formStyles from "../components/Form.module.css";

export default function ScreenEditor() {
    const { displays, createDisplay, deleteDisplay } = useDisplays();
    const { screens, updateScreen, deleteScreen, createScreen, exportScreens, importScreens } = useScreens();
    const { geocode } = useGeocode();
    const screenEditor = useScreenEditor(displays[0]?.id || "");

    const [showImportExport, setShowImportExport] = useState(false);
    const [conflictMode, setConflictMode] = useState<ConflictMode>("update");
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const [selectedDisplayId, setSelectedDisplayId] = useState<string | null>(null);
    const [newDisplayName, setNewDisplayName] = useState("");

    const [deleteConfirm, setDeleteConfirm] = useState<{
        show: boolean;
        type: "screen" | "display";
        id: string;
        name: string;
    } | null>(null);

    useEffect(() => {
        if (displays.length > 0 && !selectedDisplayId) {
            setSelectedDisplayId(displays[0].id);
        }
    }, [displays, selectedDisplayId]);

    useEffect(() => {
        if (displays.length > 0 && !screenEditor.newScreenData.displayId) {
            screenEditor.updateNewScreenData("displayId", displays[0].id);
        }
    }, [displays, screenEditor.newScreenData.displayId]);

    const handleCreateDisplay = async () => {
        if (!newDisplayName.trim()) return;
        const success = await createDisplay(newDisplayName);
        if (!success) {
            alert("Aanmaken mislukt - controleer of de naam uniek is");
            return;
        }
        setNewDisplayName("");
    };

    const showDeleteDisplayConfirm = (id: string, name: string) => {
        setDeleteConfirm({ show: true, type: "display", id, name: name || id });
    };

    const handleDeleteDisplay = async (id: string) => {
        const success = await deleteDisplay(id);
        if (!success) {
            alert("Verwijderen mislukt");
            return;
        }
        if (selectedDisplayId === id) {
            setSelectedDisplayId(displays.find(d => d.id !== id)?.id || null);
        }
    };

    const handleEdit = (screen: Screen) => {
        screenEditor.startEdit(screen);
    };

    const handleSave = async () => {
        if (!screenEditor.editingId || !screenEditor.formData) return;
        const success = await updateScreen(screenEditor.editingId, screenEditor.formData);
        if (!success) {
            alert("Opslaan mislukt");
            return;
        }
        screenEditor.cancelEdit();
    };

    const showDeleteScreenConfirm = (id: string, name: string) => {
        setDeleteConfirm({ show: true, type: "screen", id, name: name || id });
    };

    const handleDeleteScreen = async (id: string) => {
        const success = await deleteScreen(id);
        if (!success) return;
        screenEditor.cancelEdit();
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === "display") {
            await handleDeleteDisplay(deleteConfirm.id);
        } else {
            await handleDeleteScreen(deleteConfirm.id);
        }
        setDeleteConfirm(null);
    };

    const handleCreate = async () => {
        if (!screenEditor.newScreenData.displayId) {
            alert("Display is verplicht");
            return;
        }
        const success = await createScreen({
            displayId: screenEditor.newScreenData.displayId,
            x: screenEditor.newScreenData.x,
            y: screenEditor.newScreenData.y,
            width: screenEditor.newScreenData.width,
            height: screenEditor.newScreenData.height,
            name: screenEditor.newScreenData.name || undefined,
            lat: screenEditor.newScreenData.lat || undefined,
            lng: screenEditor.newScreenData.lng || undefined,
            address: screenEditor.newScreenData.address || undefined,
        });
        if (!success) {
            alert("Aanmaken mislukt");
            return;
        }
        screenEditor.cancelCreate();
        screenEditor.resetNewScreenData(displays[0]?.id || "");
    };

    const handleExport = async () => {
        const data = await exportScreens();
        if (!data) {
            alert("Export mislukt");
            return;
        }
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
    };

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
            const result = await importScreens(data.screens, conflictMode);
            setImportResult(result);
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
            const fileInput = event.target as HTMLInputElement;
            if (fileInput) {
                fileInput.value = "";
            }
        }
    };

    const handleSelectDisplay = (id: string) => {
        setSelectedDisplayId(id);
        screenEditor.setEditingId(null);
        screenEditor.setIsCreating(false);
    };

    const displayScreens = screens.filter(s => s.displayId === selectedDisplayId);

    return (
        <div className={`${styles.screenEditor} ${styles.compact}`}>
            <header>
                <h1>Screen Editor</h1>
                <div className={styles.headerActions}>
                    <button
                        className={`${styles.toggleBtn} ${showImportExport ? styles.active : ""}`}
                        onClick={() => setShowImportExport(!showImportExport)}
                    >
                        Import/Export
                    </button>
                    <Link to="/" className={buttonStyles.backLink}>Terug</Link>
                </div>
            </header>

            <ImportExport
                show={showImportExport}
                conflictMode={conflictMode}
                importResult={importResult}
                isImporting={isImporting}
                onToggle={() => setShowImportExport(!showImportExport)}
                onSetConflictMode={setConflictMode}
                onExport={handleExport}
                onImport={handleImport}
                onClearImportResult={() => setImportResult(null)}
            />

            <div className={styles.editorLayout}>
                <DisplayList
                    displays={displays}
                    selectedDisplayId={selectedDisplayId}
                    newDisplayName={newDisplayName}
                    onCreateDisplay={handleCreateDisplay}
                    onSetNewDisplayName={setNewDisplayName}
                    onSelectDisplay={handleSelectDisplay}
                    onDeleteDisplay={showDeleteDisplayConfirm}
                />

                <section className={styles.screensPanel}>
                    {selectedDisplayId ? (
                        <>
                            <div className={styles.panelHeader}>
                                <h2>Schermen - {displays.find(d => d.id === selectedDisplayId)?.name || selectedDisplayId}</h2>
                                <button
                                    className={`${buttonStyles.btnPrimary} ${screenEditor.isCreating ? buttonStyles.btnCancel : ""}`}
                                    onClick={() => {
                                        if (screenEditor.isCreating) {
                                            screenEditor.cancelCreate();
                                        } else {
                                            screenEditor.startCreate(selectedDisplayId);
                                        }
                                    }}
                                >
                                    {screenEditor.isCreating ? "Annuleren" : "+ Nieuw Scherm"}
                                </button>
                            </div>

                            <ScreenProperties
                                isCreating={screenEditor.isCreating}
                                editingId={screenEditor.editingId}
                                formData={screenEditor.formData}
                                newScreenData={screenEditor.newScreenData}
                                editPostcode={screenEditor.editPostcode}
                                editHuisnummer={screenEditor.editHuisnummer}
                                newScreenLocationMode={screenEditor.newScreenLocationMode}
                                editLocationMode={screenEditor.editLocationMode}
                                onNewScreenChange={screenEditor.updateNewScreenData}
                                onInputChange={screenEditor.updateFormData}
                                onCreate={handleCreate}
                                onCancelCreate={screenEditor.cancelCreate}
                                onSave={handleSave}
                                onCancelEdit={screenEditor.cancelEdit}
                                onGeocode={geocode}
                                onSetEditPostcode={screenEditor.setEditPostcode}
                                onSetEditHuisnummer={screenEditor.setEditHuisnummer}
                                onSetNewScreenLocationMode={screenEditor.setNewScreenLocationMode}
                                onSetEditLocationMode={screenEditor.setEditLocationMode}
                                onShowDeleteConfirm={showDeleteScreenConfirm}
                            />

                            <ScreenCanvas
                                screens={displayScreens}
                                editingId={screenEditor.editingId}
                                onScreenClick={handleEdit}
                            />

                            <table className={styles.screenTable}>
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
                                            className={screenEditor.editingId === screen.id ? styles.selectedRow : ""}
                                        >
                                            <td>{screen.name || screen.id}</td>
                                            <td>{screen.x}</td>
                                            <td>{screen.y}</td>
                                            <td>{screen.width}</td>
                                            <td>{screen.height}</td>
                                            <td>{screen.lat?.toFixed(5)}</td>
                                            <td>{screen.lng?.toFixed(5)}</td>
                                            <td>{screen.address}</td>
                                            <td className={styles.actions}>
                                                <button
                                                    className={`${buttonStyles.btnIcon} ${buttonStyles.btnEdit}`}
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(screen); }}
                                                    title="Bewerken"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className={`${buttonStyles.btnIcon} ${buttonStyles.btnDelete}`}
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
                                <p className={styles.emptyMessage}>Geen schermen. Voeg een scherm toe.</p>
                            )}
                        </>
                    ) : (
                        <p className={styles.emptyMessage}>Selecteer of maak een display om schermen te beheren.</p>
                    )}
                </section>
            </div>

            {
                deleteConfirm?.show && (
                    <div className={modalStyles.confirmOverlay} onClick={() => setDeleteConfirm(null)}>
                        <div className={modalStyles.confirmDialog} onClick={(e) => e.stopPropagation()}>
                            <div className={modalStyles.confirmIcon}>⚠️</div>
                            <h3>Verwijderen bevestigen</h3>
                            <p>
                                Weet je zeker dat je {deleteConfirm.type === "display" ? "display" : "scherm"}{" "}
                                <strong>"{deleteConfirm.name}"</strong> wilt verwijderen?
                            </p>
                            {deleteConfirm.type === "display" && (
                                <p className={modalStyles.confirmWarning}>
                                    ⚠️ Alle schermen in deze display worden ook verwijderd!
                                </p>
                            )}
                            <div className={modalStyles.confirmButtons}>
                                <button
                                    className={buttonStyles.btnSecondary}
                                    onClick={() => setDeleteConfirm(null)}
                                >
                                    Annuleren
                                </button>
                                <button
                                    className={buttonStyles.btnDanger}
                                    onClick={handleConfirmDelete}
                                >
                                    Verwijderen
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
