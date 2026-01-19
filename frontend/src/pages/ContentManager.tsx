import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { trpcClient, Content, getAuthHeaders } from "../utils/trpc";

// Get backend URL for uploads
const API_BASE = "";

export default function ContentManager() {
    const [contents, setContents] = useState<Content[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [renameModal, setRenameModal] = useState<{ content: Content; newName: string } | null>(null);

    // Fetch categories and content
    const loadContent = useCallback(async () => {
        try {
            const categoryList = await trpcClient.content.getCategories.query();
            const allCategories = categoryList.length > 0 ? categoryList : ["Algemeen"];
            setCategories(allCategories);

            // Set default category if none selected
            const categoryToUse = selectedCategory || allCategories[0];
            if (!selectedCategory && allCategories[0]) {
                setSelectedCategory(allCategories[0]);
            }

            const contentList = await trpcClient.content.list.query({ category: categoryToUse });
            setContents(contentList);
        } catch (error) {
            console.error("Failed to load content:", error);
        }
    }, [selectedCategory]);

    useEffect(() => {
        loadContent();
    }, [loadContent]);

    // Handle file upload
    const uploadFile = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            // IMPORTANT: category must be appended BEFORE file for Multer to receive it in time
            formData.append("category", selectedCategory);
            formData.append("file", file);

            const response = await fetch(`${API_BASE}/api/upload`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            await loadContent();
        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload mislukt");
        } finally {
            setUploading(false);
        }
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
                await uploadFile(file);
            }
        }
    };

    // File input handler
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
            await uploadFile(file);
        }
        e.target.value = "";
    };

    // Delete content
    const handleDelete = async (content: Content) => {
        if (!confirm(`Weet je zeker dat je "${content.filename}" wilt verwijderen?`)) {
            return;
        }

        try {

            await trpcClient.content.delete.mutate({ id: content.id });
            await loadContent();
        } catch (error) {
            console.error("Delete error:", error);
            alert("Verwijderen mislukt");
        }
    };

    // Open rename modal
    const handleRename = (content: Content) => {
        const ext = content.filename.lastIndexOf(".") > 0
            ? content.filename.substring(content.filename.lastIndexOf("."))
            : "";
        const nameWithoutExt = content.filename.replace(ext, "");
        setRenameModal({ content, newName: nameWithoutExt });
    };

    // Submit rename
    const submitRename = async () => {
        if (!renameModal) return;

        const ext = renameModal.content.filename.lastIndexOf(".") > 0
            ? renameModal.content.filename.substring(renameModal.content.filename.lastIndexOf("."))
            : "";
        const originalName = renameModal.content.filename.replace(ext, "");

        if (!renameModal.newName || renameModal.newName === originalName) {
            setRenameModal(null);
            return;
        }

        try {
            await trpcClient.content.rename.mutate({
                id: renameModal.content.id,
                newFilename: renameModal.newName,
            });
            setRenameModal(null);
            await loadContent();
        } catch (error) {
            console.error("Rename error:", error);
            alert(error instanceof Error ? error.message : "Hernoemen mislukt");
        }
    };

    return (
        <div className="content-manager">
            <header>
                <h1>📁 Content Manager</h1>
                <Link to="/" className="back-link">← Terug</Link>
            </header>

            <div className="category-selector">
                <label>Categorie:</label>
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                >
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>
                            {cat}
                        </option>
                    ))}
                </select>
                <input
                    type="text"
                    placeholder="Nieuwe categorie..."
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value) {
                            const newCat = e.currentTarget.value;
                            if (!categories.includes(newCat)) {
                                setCategories([...categories, newCat]);
                            }
                            setSelectedCategory(newCat);
                            e.currentTarget.value = "";
                        }
                    }}
                />
            </div>

            <div
                className={`upload-zone ${isDragging ? "dragging" : ""} ${uploading ? "uploading" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {uploading ? (
                    <p>⏳ Bezig met uploaden...</p>
                ) : (
                    <>
                        <p>📤 Sleep bestanden hierheen of</p>
                        <label className="upload-button">
                            Kies bestand
                            <input
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                onChange={handleFileSelect}
                                hidden
                            />
                        </label>
                    </>
                )}
            </div>

            <div className="content-grid">
                {contents.length === 0 ? (
                    <p className="empty-message">Geen content in deze categorie</p>
                ) : (
                    contents.map((content) => (
                        <div key={content.id} className="content-card">
                            {content.mimeType.startsWith("image/") ? (
                                <img src={content.path} alt={content.filename} />
                            ) : (
                                <video src={content.path} />
                            )}
                            <div className="content-info">
                                <span className="filename">{content.filename}</span>
                                <div className="content-actions">
                                    <button
                                        className="rename-btn"
                                        onClick={() => handleRename(content)}
                                        title="Hernoemen"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDelete(content)}
                                        title="Verwijderen"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Rename Modal */}
            {renameModal && (
                <div className="confirm-overlay" onClick={() => setRenameModal(null)}>
                    <div className="rename-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-icon">✏️</div>
                        <h3>Bestand hernoemen</h3>
                        <p>Voer een nieuwe naam in voor dit bestand:</p>
                        <input
                            type="text"
                            className="rename-input"
                            value={renameModal.newName}
                            onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submitRename();
                                if (e.key === "Escape") setRenameModal(null);
                            }}
                            autoFocus
                        />
                        <div className="confirm-buttons">
                            <button
                                className="btn-secondary"
                                onClick={() => setRenameModal(null)}
                            >
                                Annuleren
                            </button>
                            <button
                                className="btn-primary"
                                onClick={submitRename}
                            >
                                Hernoemen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
