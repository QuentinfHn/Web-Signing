import { useRef } from "react";
import { ConflictMode, ImportResult } from "../../types/screen";
import styles from "../../pages/ScreenEditor.module.css";
import buttonStyles from "../Button.module.css";
import formStyles from "../Form.module.css";

interface ImportExportProps {
    show: boolean;
    conflictMode: ConflictMode;
    importResult: ImportResult | null;
    isImporting: boolean;
    onToggle: () => void;
    onSetConflictMode: (mode: ConflictMode) => void;
    onExport: () => Promise<void>;
    onImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    onClearImportResult: () => void;
}

export function ImportExport({
    show,
    conflictMode,
    importResult,
    isImporting,
    onToggle,
    onSetConflictMode,
    onExport,
    onImport,
    onClearImportResult,
}: ImportExportProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            {show && (
                <section className={`${styles.compactSection} ${styles.controlSection}`}>
                    <div className={styles.importExportRow}>
                        <button className={buttonStyles.btnSecondary} onClick={onExport}>Export JSON</button>
                        <div className={styles.importGroup}>
                            <select
                                value={conflictMode}
                                onChange={(e) => onSetConflictMode(e.target.value as unknown as ConflictMode)}
                                className={formStyles.selectSmall}
                            >
                                <option value="update">Overschrijven</option>
                                <option value="skip">Overslaan</option>
                                <option value="error">Fout melden</option>
                            </select>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={async (e) => {
                                    await onImport(e);
                                    onClearImportResult();
                                }}
                                disabled={isImporting}
                                id="import-file"
                                className={styles.fileInput}
                            />
                            <label htmlFor="import-file" className={buttonStyles.btnSecondary}>
                                {isImporting ? "Importeren..." : "Import JSON"}
                            </label>
                        </div>
                    </div>
                    {importResult && (
                        <div className={`${styles.importResultCompact} ${importResult.errors.length > 0 ? "has-errors" : ""}`}>
                            <span>{importResult.created} nieuw</span>
                            <span>{importResult.updated} bijgewerkt</span>
                            <span>{importResult.skipped} overgeslagen</span>
                            {importResult.errors.map((err, i) => (
                                <span key={i} className="error">{err}</span>
                            ))}
                            <button className={buttonStyles.btnSmall} onClick={onClearImportResult}>x</button>
                        </div>
                    )}
                </section>
            )}
        </>
    );
}
