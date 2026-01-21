import { Screen } from "../../utils/trpc";
import { LocationMode } from "../../types/screen";
import { GeocodeResult } from "../../hooks/useGeocode";

interface ScreenPropertiesProps {
    isCreating: boolean;
    editingId: string | null;
    formData: Partial<Screen>;
    newScreenData: {
        displayId: string;
        x: number;
        y: number;
        width: number;
        height: number;
        name: string;
        lat: number;
        lng: number;
        address: string;
        postcode: string;
        huisnummer: string;
    };
    editPostcode: string;
    editHuisnummer: string;
    newScreenLocationMode: LocationMode;
    editLocationMode: LocationMode;
    onNewScreenChange: (field: string, value: string | number) => void;
    onInputChange: (field: keyof Screen, value: string | number) => void;
    onCreate: () => void;
    onCancelCreate: () => void;
    onSave: () => void;
    onCancelEdit: () => void;
    onGeocode: (address: string) => Promise<GeocodeResult | null>;
    onSetEditPostcode: (value: string) => void;
    onSetEditHuisnummer: (value: string) => void;
    onSetNewScreenLocationMode: (mode: LocationMode) => void;
    onSetEditLocationMode: (mode: LocationMode) => void;
    onShowDeleteConfirm: (id: string, name: string) => void;
}

export function ScreenProperties({
    isCreating,
    editingId,
    formData,
    newScreenData,
    editPostcode,
    editHuisnummer,
    newScreenLocationMode,
    editLocationMode,
    onNewScreenChange,
    onInputChange,
    onCreate,
    onCancelCreate,
    onSave,
    onCancelEdit,
    onGeocode,
    onSetEditPostcode,
    onSetEditHuisnummer,
    onSetNewScreenLocationMode,
    onSetEditLocationMode,
    onShowDeleteConfirm,
}: ScreenPropertiesProps) {
    const handleGeocodeNew = async () => {
        const result = await onGeocode(`${newScreenData.postcode} ${newScreenData.huisnummer}`);
        if (result) {
            onNewScreenChange("lat", result.lat);
            onNewScreenChange("lng", result.lng);
            onNewScreenChange("address", result.address);
            alert(`Locatie gevonden: ${result.address}`);
        } else {
            alert("Fout bij zoeken locatie");
        }
    };

    const handleGeocodeEdit = async () => {
        const result = await onGeocode(`${editPostcode} ${editHuisnummer}`);
        if (result) {
            onInputChange("lat", result.lat);
            onInputChange("lng", result.lng);
            onInputChange("address", result.address);
            alert(`Locatie gevonden: ${result.address}`);
        } else {
            alert("Fout bij zoeken locatie");
        }
    };

    return (
        <>
            {isCreating && (
                <div className="edit-modal">
                    <div className="edit-modal-header">
                        <span>📺 Nieuw Scherm Toevoegen</span>
                    </div>

                    <div className="edit-modal-body">
                        <div className="edit-modal-row">
                            <label>Naam:</label>
                            <input
                                type="text"
                                placeholder="bijv. Lobby Display 1"
                                value={newScreenData.name}
                                onChange={e => onNewScreenChange("name", e.target.value)}
                            />
                        </div>

                        <div className="edit-modal-row">
                            <label>X:</label>
                            <input
                                type="number"
                                value={newScreenData.x}
                                onChange={e => onNewScreenChange("x", parseInt(e.target.value) || 0)}
                            />
                            <label>Y:</label>
                            <input
                                type="number"
                                value={newScreenData.y}
                                onChange={e => onNewScreenChange("y", parseInt(e.target.value) || 0)}
                            />
                            <label>Breedte:</label>
                            <input
                                type="number"
                                value={newScreenData.width}
                                onChange={e => onNewScreenChange("width", parseInt(e.target.value) || 0)}
                            />
                            <label>Hoogte:</label>
                            <input
                                type="number"
                                value={newScreenData.height}
                                onChange={e => onNewScreenChange("height", parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <div className="edit-modal-row">
                            <label>Locatie:</label>
                            <div className="location-mode-toggle">
                                <label className={`toggle-option ${newScreenLocationMode === "address" ? "active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="newLocationMode"
                                        value="address"
                                        checked={newScreenLocationMode === "address"}
                                        onChange={() => onSetNewScreenLocationMode("address")}
                                    />
                                    Adres
                                </label>
                                <label className={`toggle-option ${newScreenLocationMode === "coordinates" ? "active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="newLocationMode"
                                        value="coordinates"
                                        checked={newScreenLocationMode === "coordinates"}
                                        onChange={() => onSetNewScreenLocationMode("coordinates")}
                                    />
                                    Coördinaten
                                </label>
                            </div>
                        </div>

                        {newScreenLocationMode === "address" ? (
                            <div className="edit-modal-row">
                                <label></label>
                                <input
                                    type="text"
                                    placeholder="Postcode"
                                    value={newScreenData.postcode}
                                    onChange={e => onNewScreenChange("postcode", e.target.value.toUpperCase())}
                                    maxLength={7}
                                    className="input-postcode"
                                />
                                <input
                                    type="text"
                                    placeholder="Nr"
                                    value={newScreenData.huisnummer}
                                    onChange={e => onNewScreenChange("huisnummer", e.target.value)}
                                    className="input-huisnummer"
                                />
                                <button
                                    type="button"
                                    className="btn-geocode-small"
                                    onClick={handleGeocodeNew}
                                    disabled={!newScreenData.postcode || !newScreenData.huisnummer}
                                >
                                    📍 Zoek
                                </button>
                                {newScreenData.address && (
                                    <span className="address-found">✓ {newScreenData.address}</span>
                                )}
                            </div>
                        ) : (
                            <div className="edit-modal-row">
                                <label></label>
                                <label>Lat:</label>
                                <input
                                    type="number"
                                    placeholder="52.0000"
                                    value={newScreenData.lat || ""}
                                    onChange={e => onNewScreenChange("lat", parseFloat(e.target.value) || 0)}
                                    step="0.00001"
                                    className="input-coordinate"
                                />
                                <label>Lng:</label>
                                <input
                                    type="number"
                                    placeholder="4.0000"
                                    value={newScreenData.lng || ""}
                                    onChange={e => onNewScreenChange("lng", parseFloat(e.target.value) || 0)}
                                    step="0.00001"
                                    className="input-coordinate"
                                />
                            </div>
                        )}
                    </div>

                    <div className="edit-modal-footer">
                        <div></div>
                        <div className="edit-modal-footer-right">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={onCancelCreate}
                            >
                                Annuleren
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={onCreate}
                            >
                                ✓ Scherm Toevoegen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingId && (
                <div className="edit-modal">
                    <div className="edit-modal-header">
                        <span>✏️ Scherm Bewerken</span>
                        <span className="edit-modal-id">ID: {editingId}</span>
                    </div>

                    <div className="edit-modal-body">
                        <div className="edit-modal-row">
                            <label>Naam:</label>
                            <input
                                type="text"
                                placeholder="Schermnaam"
                                value={formData.name || ""}
                                onChange={e => onInputChange("name", e.target.value)}
                            />
                        </div>

                        <div className="edit-modal-row">
                            <label>X:</label>
                            <input
                                type="number"
                                value={formData.x ?? 0}
                                onChange={e => onInputChange("x", parseInt(e.target.value) || 0)}
                            />
                            <label>Y:</label>
                            <input
                                type="number"
                                value={formData.y ?? 0}
                                onChange={e => onInputChange("y", parseInt(e.target.value) || 0)}
                            />
                            <label>Breedte:</label>
                            <input
                                type="number"
                                value={formData.width ?? 0}
                                onChange={e => onInputChange("width", parseInt(e.target.value) || 0)}
                            />
                            <label>Hoogte:</label>
                            <input
                                type="number"
                                value={formData.height ?? 0}
                                onChange={e => onInputChange("height", parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <div className="edit-modal-row">
                            <label>Locatie:</label>
                            <div className="location-mode-toggle">
                                <label className={`toggle-option ${editLocationMode === "address" ? "active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="editLocationMode"
                                        value="address"
                                        checked={editLocationMode === "address"}
                                        onChange={() => onSetEditLocationMode("address")}
                                    />
                                    Adres
                                </label>
                                <label className={`toggle-option ${editLocationMode === "coordinates" ? "active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="editLocationMode"
                                        value="coordinates"
                                        checked={editLocationMode === "coordinates"}
                                        onChange={() => onSetEditLocationMode("coordinates")}
                                    />
                                    Coördinaten
                                </label>
                            </div>
                        </div>

                        {editLocationMode === "address" ? (
                            <div className="edit-modal-row">
                                <label></label>
                                <input
                                    type="text"
                                    placeholder="Postcode"
                                    value={editPostcode}
                                    onChange={e => onSetEditPostcode(e.target.value.toUpperCase())}
                                    maxLength={7}
                                    className="input-postcode"
                                />
                                <input
                                    type="text"
                                    placeholder="Nr"
                                    value={editHuisnummer}
                                    onChange={e => onSetEditHuisnummer(e.target.value)}
                                    className="input-huisnummer"
                                />
                                <button
                                    type="button"
                                    className="btn-geocode-small"
                                    onClick={handleGeocodeEdit}
                                    disabled={!editPostcode || !editHuisnummer}
                                >
                                    📍 Zoek
                                </button>
                                {formData.address && (
                                    <span className="address-found">✓ {formData.address}</span>
                                )}
                            </div>
                        ) : (
                            <div className="edit-modal-row">
                                <label></label>
                                <label>Lat:</label>
                                <input
                                    type="number"
                                    placeholder="52.0000"
                                    value={formData.lat || ""}
                                    onChange={e => onInputChange("lat", parseFloat(e.target.value) || 0)}
                                    step="0.00001"
                                    className="input-coordinate"
                                />
                                <label>Lng:</label>
                                <input
                                    type="number"
                                    placeholder="4.0000"
                                    value={formData.lng || ""}
                                    onChange={e => onInputChange("lng", parseFloat(e.target.value) || 0)}
                                    step="0.00001"
                                    className="input-coordinate"
                                />
                            </div>
                        )}
                    </div>

                    <div className="edit-modal-footer">
                        <button
                            type="button"
                            className="btn-danger"
                            onClick={() => onShowDeleteConfirm(editingId, formData.name || editingId)}
                        >
                            🗑️ Verwijderen
                        </button>
                        <div className="edit-modal-footer-right">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={onCancelEdit}
                            >
                                Annuleren
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={onSave}
                            >
                                ✓ Opslaan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
