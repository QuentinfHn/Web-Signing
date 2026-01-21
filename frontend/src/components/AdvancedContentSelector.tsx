import { useState, useMemo, useRef, useEffect } from "react";
import { Content, trpcClient } from "../utils/trpc";
import styles from "./AdvancedContentSelector.module.css";

interface AdvancedContentSelectorProps {
    value: string;
    onChange: (path: string) => void;
    contentLibrary: Content[];
    onContentUpdate?: (updatedContent: Content) => void;
}

export default function AdvancedContentSelector({
    value,
    onChange,
    contentLibrary,
    onContentUpdate,
}: AdvancedContentSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<string>("all");
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get unique categories from content
    const categories = useMemo(() => {
        const cats = new Set(contentLibrary.map((c) => c.category));
        return Array.from(cats).sort();
    }, [contentLibrary]);

    // Get selected content item
    const selectedContent = useMemo(() => {
        return contentLibrary.find((c) => c.path === value);
    }, [contentLibrary, value]);

    // Filter content based on search and active filter
    const filteredContent = useMemo(() => {
        let filtered = contentLibrary;

        // Apply category filter
        if (activeFilter !== "all" && activeFilter !== "favorites" && activeFilter !== "recent") {
            filtered = filtered.filter((c) => c.category === activeFilter);
        }

        // Apply favorites filter
        if (activeFilter === "favorites") {
            filtered = filtered.filter((c) => c.isFavorite);
        }

        // Apply recent filter (last 2 created)
        if (activeFilter === "recent") {
            filtered = [...filtered]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 2);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((c) =>
                c.filename.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [contentLibrary, activeFilter, searchQuery]);

    // Group content by category
    const groupedContent = useMemo(() => {
        const groups: Record<string, Content[]> = {};

        // Add favorites group if there are favorites and not filtering by specific category
        const favorites = filteredContent.filter((c) => c.isFavorite);
        if (favorites.length > 0 && activeFilter === "all") {
            groups["Favorieten"] = favorites;
        }

        // Group by category
        filteredContent.forEach((content) => {
            const category = content.category.toUpperCase();
            if (!groups[category]) {
                groups[category] = [];
            }
            if (!groups[category].find((c) => c.id === content.id)) {
                groups[category].push(content);
            }
        });

        return groups;
    }, [filteredContent, activeFilter]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as unknown as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as unknown as Node)) {
                setIsOpen(false);
                setDropdownPosition(null);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Calculate dropdown position
    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const dropdownHeight = 350;

            // Calculate if dropdown should appear above or below the trigger
            const spaceBelow = windowHeight - triggerRect.bottom;
            const showAbove = spaceBelow < dropdownHeight + 20 && triggerRect.top > dropdownHeight + 20;

            const top = showAbove ? triggerRect.top - dropdownHeight - 4 : triggerRect.bottom + 4;

            setDropdownPosition({
                top,
                left: triggerRect.left,
                width: triggerRect.width
            });
        }
    }, [isOpen]);

    const handleToggleFavorite = async (e: React.MouseEvent, content: Content) => {
        e.stopPropagation();
        try {
            const updated = await trpcClient.content.toggleFavorite.mutate({ id: content.id });
            if (onContentUpdate) {
                onContentUpdate(updated);
            }
        } catch (error) {
            console.error("Failed to toggle favorite:", error);
        }
    };

    const handleSelect = (content: Content) => {
        onChange(content.path);
        setIsOpen(false);
        setSearchQuery("");
        setDropdownPosition(null);
    };

    const handleClear = () => {
        onChange("");
        setIsOpen(false);
        setDropdownPosition(null);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileTypeIcon = (mimeType: string): string => {
        if (mimeType.startsWith("image/")) return "🖼️";
        if (mimeType.startsWith("video/")) return "🎬";
        return "📄";
    };

    return (
        <div className={styles.advancedContentSelector} ref={dropdownRef}>
            {/* Trigger button */}
            <button
                type="button"
                className={styles.contentSelectorTrigger}
                onClick={() => setIsOpen(!isOpen)}
                ref={triggerRef}
            >
                <span className={styles.selectedContent}>
                    {selectedContent ? (
                        <>
                            <span className={styles.fileIcon}>{getFileTypeIcon(selectedContent.mimeType)}</span>
                            <span className={styles.fileName}>{selectedContent.filename}</span>
                        </>
                    ) : (
                        <span className={styles.placeholder}>-- Geen content --</span>
                    )}
                </span>
                <span className={styles.dropdownArrow}>{isOpen ? "▲" : "▼"}</span>
            </button>

            {/* Dropdown panel */}
            {isOpen && dropdownPosition && (
                <div
                    className={styles.contentSelectorDropdown}
                    style={{
                        position: 'fixed',
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                        width: dropdownPosition.width,
                        maxHeight: 'min(350px, calc(100vh - 20px))'
                    }}
                >
                    {/* Filter tabs */}
                    <div className={styles.filterTabs}>
                        <button
                            className={`${styles.filterTab} ${activeFilter === "all" ? styles.active : ""}`}
                            onClick={() => setActiveFilter("all")}
                        >
                            Alle
                        </button>
                        <button
                            className={`${styles.filterTab} ${activeFilter === "favorites" ? styles.active : ""}`}
                            onClick={() => setActiveFilter("favorites")}
                        >
                            ★ Favorieten
                        </button>
                        <button
                            className={`${styles.filterTab} ${activeFilter === "recent" ? styles.active : ""}`}
                            onClick={() => setActiveFilter("recent")}
                        >
                            Recent
                        </button>
                        {categories.slice(0, 3).map((cat) => (
                            <button
                                key={cat}
                                className={`${styles.filterTab} ${activeFilter === cat ? styles.active : ""}`}
                                onClick={() => setActiveFilter(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Search input */}
                    <div className={styles.searchContainer}>
                        <input
                            type="text"
                            className={styles.contentSearchInput}
                            placeholder="Zoek content..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                className={styles.clearSearch}
                                onClick={() => setSearchQuery("")}
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {/* Content list */}
                    <div className={styles.contentList}>
                        {/* No content option */}
                        <div className={styles.contentGroup}>
                            <div className={styles.groupHeader}>OPTIES</div>
                            <div
                                className={`${styles.contentItem} ${!value ? styles.selected : ""}`}
                                onClick={handleClear}
                            >
                                <div className={styles.contentItemInfo}>
                                    <span className={styles.contentName}>Geen content</span>
                                    <span className={styles.contentDetails}>Maak scherm leeg</span>
                                </div>
                            </div>
                        </div>

                        {/* Grouped content */}
                        {Object.entries(groupedContent).map(([groupName, items]) => (
                            <div key={groupName} className={styles.contentGroup}>
                                <div className={styles.groupHeader}>{groupName}</div>
                                {items.map((content) => (
                                    <div
                                        key={content.id}
                                        className={`${styles.contentItem} ${content.path === value ? styles.selected : ""}`}
                                        onClick={() => handleSelect(content)}
                                    >
                                        <div className={styles.contentItemInfo}>
                                            <span className={styles.contentName}>
                                                {getFileTypeIcon(content.mimeType)} {content.filename}
                                            </span>
                                            <span className={styles.contentDetails}>
                                                {formatFileSize(content.size)} • {content.category}
                                            </span>
                                        </div>
                                        <button
                                            className={`${styles.favoriteBtn} ${content.isFavorite ? styles.isFavorite : ""}`}
                                            onClick={(e) => handleToggleFavorite(e, content)}
                                            title={content.isFavorite ? "Verwijder uit favorieten" : "Voeg toe aan favorieten"}
                                        >
                                            {content.isFavorite ? "★" : "☆"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ))}

                        {/* Empty state */}
                        {Object.keys(groupedContent).length === 0 && (
                            <div className={styles.emptyState}>
                                Geen content gevonden
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
