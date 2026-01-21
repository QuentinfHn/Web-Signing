import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { trpcClient, Content, getAuthHeaders } from "../utils/trpc";
import styles from "./ContentManager.module.css";
import buttonStyles from "../components/Button.module.css";
import modalStyles from "../components/Modal.module.css";
import formStyles from "../components/Form.module.css";

// Get backend URL for uploads
const API_BASE = "";

export default function ContentManager() {
    const [contents, setContents] = useState<Content[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [renameModal, setRenameModal] = useState<{ content: Content; newName: string } | null>(null);
    const [scanResult, setScanResult] = useState<{ type: "success" | "info" | "error"; message: string } | null>(null);

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
        <div className={styles.contentManager}>
            <header>
                <h1>📁 Content Manager</h1>
                <div className={styles.headerActions}>
                    <button
                        className={styles.scanBtn}
                        onClick={async () => {
                            try {
                                const result = await trpcClient.content.scan.mutate();
                                if (result.added > 0) {
                                    setScanResult({ type: "success", message: `✅ ${result.added} nieuwe bestand(en) gevonden` });
                                    loadContent();
                                } else {
                                    setScanResult({ type: "info", message: "Geen nieuwe bestanden gevonden" });
                                }
                            } catch (error) {
                                console.error("Scan error:", error);
                                setScanResult({ type: "error", message: "Scannen mislukt" });
                            }
                            // Auto-hide after 3 seconds
                            setTimeout(() => setScanResult(null), 3000);
                        }}
                        title="Scan folder voor nieuwe bestanden"
                    >
                        🔄 Scan folder
                    </button>
                    <Link to="/" className={buttonStyles.backLink}>← Terug</Link>
                </div>
            </header>

            <div className={styles.categorySelector}>
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
                className={`${styles.uploadZone} ${isDragging ? styles.dragging : ""} ${uploading ? styles.uploading : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {uploading ? (
                    <p>⏳ Bezig met uploaden...</p>
                ) : (
                    <>
                        <p>📤 Sleep bestanden hierheen of</p>
                        <label className={styles.uploadButton}>
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

            <div className={styles.contentGrid}>
                {contents.length === 0 ? (
                    <p className={styles.emptyMessage}>Geen content in deze categorie</p>
                ) : (
                    contents.map((content) => (
                        <div key={content.id} className={styles.contentCard}>
                            {content.mimeType.startsWith("image/") ? (
                                <img src={content.path} alt={content.filename} />
                            ) : (
                                <video src={content.path} />
                            )}
                            <div className={styles.contentInfo}>
                                <span className={styles.filename}>{content.filename}</span>
                                <div className={styles.contentActions}>
                                    <button
                                        className={styles.renameBtn}
                                        onClick={() => handleRename(content)}
                                        title="Hernoemen"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className={styles.deleteBtn}
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
                <div className={modalStyles.confirmOverlay} onClick={() => setRenameModal(null)}>
                    <div className={modalStyles.renameDialog} onClick={(e) => e.stopPropagation()}>
                        <div className={modalStyles.confirmIcon}>✏️</div>
                        <h3>Bestand hernoemen</h3>
                        <p>Voer een nieuwe naam in voor dit bestand:</p>
                        <input
                            type="text"
                            className={formStyles.renameInput}
                            value={renameModal.newName}
                            onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submitRename();
                                if (e.key === "Escape") setRenameModal(null);
                            }}
                            autoFocus
                        />
                        <div className={modalStyles.confirmButtons}>
                            <button
                                className={buttonStyles.btnSecondary}
                                onClick={() => setRenameModal(null)}
                            >
                                Annuleren
                            </button>
                            <button
                                className={buttonStyles.btnPrimary}
                                onClick={submitRename}
                            >
                                Hernoemen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scan Result Toast */}
            {scanResult && (
                <div
                    className={`${styles.toast} ${styles[scanResult.type]}`}
                    onClick={() => setScanResult(null)}
                >
                    {scanResult.message}
                </div>
            )}
        </div>
    );
}
