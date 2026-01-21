import { useRef } from "react";
import { ConflictMode, ImportResult } from "../../types/screen";

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
                <section className="control-section compact-section">
                    <div className="import-export-row">
                        <button className="btn-secondary" onClick={onExport}>Export JSON</button>
                        <div className="import-group">
                            <select
                                value={conflictMode}
                                onChange={(e) => onSetConflictMode(e.target.value as unknown as ConflictMode)}
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
                                onChange={async (e) => {
                                    await onImport(e);
                                    onClearImportResult();
                                }}
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
                            <button className="btn-small" onClick={onClearImportResult}>x</button>
                        </div>
                    )}
                </section>
            )}
        </>
    );
}
