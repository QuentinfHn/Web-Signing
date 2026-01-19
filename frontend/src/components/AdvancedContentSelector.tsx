import { useState, useMemo, useRef, useEffect } from "react";
import { Content, trpcClient } from "../utils/trpc";

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
        if (activeFilter !== "all" && activeFilter !== "favorites") {
            filtered = filtered.filter((c) => c.category === activeFilter);
        }

        // Apply favorites filter
        if (activeFilter === "favorites") {
            filtered = filtered.filter((c) => c.isFavorite);
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

        // Add recent items (last 5 created)
        const recent = [...filteredContent]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
        if (recent.length > 0 && activeFilter === "all" && !searchQuery) {
            groups["Recent"] = recent;
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
    }, [filteredContent, activeFilter, searchQuery]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
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
    };

    const handleClear = () => {
        onChange("");
        setIsOpen(false);
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
        <div className="advanced-content-selector" ref={dropdownRef}>
            {/* Trigger button */}
            <button
                type="button"
                className="content-selector-trigger"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="selected-content">
                    {selectedContent ? (
                        <>
                            <span className="file-icon">{getFileTypeIcon(selectedContent.mimeType)}</span>
                            <span className="file-name">{selectedContent.filename}</span>
                        </>
                    ) : (
                        <span className="placeholder">-- Geen content --</span>
                    )}
                </span>
                <span className="dropdown-arrow">{isOpen ? "▲" : "▼"}</span>
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div className="content-selector-dropdown">
                    {/* Filter tabs */}
                    <div className="filter-tabs">
                        <button
                            className={`filter-tab ${activeFilter === "all" ? "active" : ""}`}
                            onClick={() => setActiveFilter("all")}
                        >
                            Alle
                        </button>
                        <button
                            className={`filter-tab ${activeFilter === "favorites" ? "active" : ""}`}
                            onClick={() => setActiveFilter("favorites")}
                        >
                            ★ Favorieten
                        </button>
                        {categories.slice(0, 3).map((cat) => (
                            <button
                                key={cat}
                                className={`filter-tab ${activeFilter === cat ? "active" : ""}`}
                                onClick={() => setActiveFilter(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Search input */}
                    <div className="search-container">
                        <input
                            type="text"
                            className="content-search-input"
                            placeholder="Zoek content..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                className="clear-search"
                                onClick={() => setSearchQuery("")}
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {/* Content list */}
                    <div className="content-list">
                        {/* No content option */}
                        <div className="content-group">
                            <div className="group-header">OPTIES</div>
                            <div
                                className={`content-item ${!value ? "selected" : ""}`}
                                onClick={handleClear}
                            >
                                <div className="content-item-info">
                                    <span className="content-name">Geen content</span>
                                    <span className="content-details">Leeg scherm</span>
                                </div>
                            </div>
                        </div>

                        {/* Grouped content */}
                        {Object.entries(groupedContent).map(([groupName, items]) => (
                            <div key={groupName} className="content-group">
                                <div className="group-header">{groupName}</div>
                                {items.map((content) => (
                                    <div
                                        key={content.id}
                                        className={`content-item ${content.path === value ? "selected" : ""}`}
                                        onClick={() => handleSelect(content)}
                                    >
                                        <div className="content-item-info">
                                            <span className="content-name">
                                                {getFileTypeIcon(content.mimeType)} {content.filename}
                                            </span>
                                            <span className="content-details">
                                                {formatFileSize(content.size)} • {content.category}
                                            </span>
                                        </div>
                                        <button
                                            className={`favorite-btn ${content.isFavorite ? "is-favorite" : ""}`}
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
                            <div className="empty-state">
                                Geen content gevonden
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
