import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { trpcClient, Screen } from "../utils/trpc";
import { useWebSocket, ScreenState, VnnoxStatusData } from "../utils/websocket";
import "leaflet/dist/leaflet.css";
import styles from "./MapOverview.module.css";
import buttonStyles from "../components/Button.module.css";

// Fix Leaflet marker icon issue
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to control map from sidebar
function MapController({ selectedScreenId, screens }: { selectedScreenId: string | null, screens: Screen[] }) {
    const map = useMap();

    useEffect(() => {
        if (selectedScreenId) {
            const screen = screens.find(s => s.id === selectedScreenId);
            if (screen && screen.lat && screen.lng) {
                map.flyTo([screen.lat, screen.lng], 16, {
                    duration: 1.5
                });
            }
        }
    }, [selectedScreenId, screens, map]);

    return null;
}

export default function MapOverview() {
    const [screens, setScreens] = useState<Screen[]>([]);
    const [screenStates, setScreenStates] = useState<ScreenState>({});
    const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
    const markerRefs = useRef<Record<string, L.Marker | null>>({});
    const [vnnoxStatuses, setVnnoxStatuses] = useState<VnnoxStatusData>({});
    const [vnnoxEnabled, setVnnoxEnabled] = useState(false);

    // Connect to WebSocket for live updates
    const handleStateUpdate = useCallback((state: ScreenState) => {
        setScreenStates(state);
    }, []);

    const handleVnnoxUpdate = useCallback((statuses: VnnoxStatusData) => {
        setVnnoxStatuses(prev => ({ ...prev, ...statuses }));
    }, []);

    const { connected } = useWebSocket(handleStateUpdate, handleVnnoxUpdate);

    useEffect(() => {
        trpcClient.screens.list.query().then(setScreens).catch(console.error);

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
    }, []);

    // Filter screens with valid coordinates
    const locatedScreens = screens.filter(s => s.lat != null && s.lng != null && s.lat !== 0 && s.lng !== 0);

    // Default center (Maastricht roughly, or average of screens)
    const center: [number, number] = [50.8514, 5.6910];

    const getScenarioName = (screenId: string) => {
        return screenStates[screenId]?.scenario || "Uit";
    };

    const handleSidebarClick = (screenId: string) => {
        setSelectedScreenId(screenId);
        // Open popup if ref exists
        const marker = markerRefs.current[screenId];
        if (marker) {
            marker.openPopup();
        }
    };

    return (
        <div className={styles.mapPage}>
            <header>
                <h1>Live Map Overview</h1>
                <div className={styles.headerActions}>
                    <span className={`${styles.connectionStatus} ${connected ? styles.connected : styles.disconnected}`}>
                        {connected ? "Verbonden" : "Niet verbonden"}
                    </span>
                    <Link to="/" className={buttonStyles.backLink}>Terug</Link>
                </div>
            </header>

            <div className={styles.mapLayout}>
                <div className={styles.mapContainer}>
                    <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapController selectedScreenId={selectedScreenId} screens={screens} />
                        {locatedScreens.map(screen => (
                            <Marker
                                key={screen.id}
                                position={[screen.lat!, screen.lng!]}
                                ref={ref => {
                                    if (ref) markerRefs.current[screen.id] = ref;
                                }}
                                eventHandlers={{
                                    click: () => setSelectedScreenId(screen.id)
                                }}
                            >
                                <Popup>
                                    <div className="map-popup">
                                        <h3>{screen.name || screen.id}</h3>
                                        <p><strong>Display:</strong> {screen.displayId}</p>
                                        <p><strong>Status:</strong> {screenStates[screen.id]?.scenario ? "▶ " + getScenarioName(screen.id) : "⏾ Uit"}</p>
                                        {vnnoxEnabled && (
                                            <p>
                                                <strong>Player:</strong>{" "}
                                                {vnnoxStatuses[screen.id] ? (
                                                    vnnoxStatuses[screen.id].onlineStatus === 1 ? (
                                                        <span style={{ color: '#22c55e' }}>● Online</span>
                                                    ) : (
                                                        <span style={{ color: '#ef4444' }}>● Offline</span>
                                                    )
                                                ) : (
                                                    <span style={{ color: '#6b7280' }}>○ Niet gekoppeld</span>
                                                )}
                                            </p>
                                        )}
                                        {screen.address && <p><strong>Adres:</strong> {screen.address}</p>}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                <aside className={styles.mapSidebar}>
                    <h2>Actieve Schermen</h2>
                    <div className={styles.screenList}>
                        {locatedScreens.map(screen => {
                            const isLive = !!screenStates[screen.id]?.scenario;
                            const statusLabel = getScenarioName(screen.id);

                            return (
                                <div
                                    key={screen.id}
                                    className={`${styles.sidebarScreenItem} ${selectedScreenId === screen.id ? styles.selected : ""}`}
                                    onClick={() => handleSidebarClick(screen.id)}
                                >
                                    <div className={styles.screenInfo}>
                                        <h3>{screen.name || screen.id}</h3>
                                        <span className={`${styles.statusBadge} ${isLive ? styles.live : styles.off}`}>
                                            {isLive ? statusLabel : "Uit"}
                                        </span>
                                    </div>
                                    <div className={styles.screenMeta}>
                                        <small>{screen.address || "Geen adres"}</small>
                                    </div>
                                </div>
                            );
                        })}
                        {locatedScreens.length === 0 && <p className={styles.emptyMessage}>Geen schermen op de kaart gevonden.</p>}
                    </div>
                </aside>
            </div>
        </div>
    );
}
