import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { trpcClient, Content } from "../utils/trpc";

// Get backend URL for uploads
const API_BASE = "";

export default function ContentManager() {
    const [contents, setContents] = useState<Content[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("shared");
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Fetch categories and content
    const loadContent = useCallback(async () => {
        try {
            const [contentList, categoryList] = await Promise.all([
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (trpcClient.content as any).list.query({ category: selectedCategory }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (trpcClient.content as any).getCategories.query(),
            ]);
            setContents(contentList);
            setCategories(["shared", ...categoryList.filter((c: string) => c !== "shared")]);
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
            formData.append("file", file);
            formData.append("category", selectedCategory);

            const response = await fetch(`${API_BASE}/api/upload`, {
                method: "POST",
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (trpcClient.content as any).delete.mutate({ id: content.id });
            await loadContent();
        } catch (error) {
            console.error("Delete error:", error);
            alert("Verwijderen mislukt");
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
                                <button
                                    className="delete-btn"
                                    onClick={() => handleDelete(content)}
                                    title="Verwijderen"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
