import { useState, useEffect, useCallback } from "react";
import { VnnoxPlayer } from "../hooks/useVnnox";
import styles from "./VnnoxPlayerSelector.module.css";

interface VnnoxPlayerSelectorProps {
    onSelect: (playerId: string, playerName: string) => void;
    onClose: () => void;
    searchPlayers: (params?: { count?: number; start?: number; name?: string }) => Promise<{
        total: number;
        players: VnnoxPlayer[];
    }>;
}

const PAGE_SIZE = 20;

export function VnnoxPlayerSelector({ onSelect, onClose, searchPlayers }: VnnoxPlayerSelectorProps) {
    const [search, setSearch] = useState("");
    const [players, setPlayers] = useState<VnnoxPlayer[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPlayers = useCallback(async (searchName: string, start: number) => {
        setLoading(true);
        setError(null);
        try {
            const result = await searchPlayers({
                count: PAGE_SIZE,
                start,
                name: searchName || undefined,
            });
            setPlayers(result.players);
            setTotal(result.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Fout bij ophalen spelers");
            setPlayers([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [searchPlayers]);

    useEffect(() => {
        fetchPlayers(search, page * PAGE_SIZE);
    }, [page]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(0);
            fetchPlayers(search, 0);
        }, 300);
        return () => clearTimeout(timer);
    }, [search, fetchPlayers]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3>VNNOX Player Selecteren</h3>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.searchBar}>
                    <input
                        type="text"
                        placeholder="Zoek op naam..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className={styles.playerList}>
                    {loading && <div className={styles.loading}>Laden...</div>}
                    {error && <div className={styles.error}>{error}</div>}
                    {!loading && !error && players.length === 0 && (
                        <div className={styles.emptyMessage}>Geen players gevonden</div>
                    )}
                    {!loading && players.map((player) => (
                        <div key={player.playerId} className={styles.playerItem}>
                            <span
                                className={`${styles.vnnoxDot} ${player.onlineStatus === 1 ? styles.online : styles.offline}`}
                                title={player.onlineStatus === 1 ? "Online" : "Offline"}
                            />
                            <div className={styles.playerInfo}>
                                <div className={styles.playerName}>{player.playerName}</div>
                                <div className={styles.playerMeta}>
                                    {player.terminalSn && `SN: ${player.terminalSn}`}
                                </div>
                            </div>
                            <button
                                className={styles.linkBtn}
                                onClick={() => onSelect(player.playerId, player.playerName)}
                            >
                                Koppel
                            </button>
                        </div>
                    ))}
                </div>

                {totalPages > 1 && (
                    <div className={styles.pagination}>
                        <button
                            disabled={page === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                            Vorige
                        </button>
                        <span>{page + 1} / {totalPages}</span>
                        <button
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Volgende
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
