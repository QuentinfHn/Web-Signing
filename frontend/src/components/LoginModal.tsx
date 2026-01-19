import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginModal() {
    const { login } = useAuth();
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        const result = await login(password);

        if (!result.success) {
            setError(result.error || "Inloggen mislukt");
            setIsLoading(false);
        }
        // On success, the AuthContext will update and this component will unmount
    };

    return (
        <div className="login-overlay">
            <div className="login-modal">
                <div className="login-header">
                    <h2>Inloggen</h2>
                    <p>Voer het wachtwoord in om toegang te krijgen tot de admin pagina's.</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="password">Wachtwoord</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Voer wachtwoord in"
                            autoFocus
                            disabled={isLoading}
                            className="login-input"
                        />
                    </div>

                    {error && (
                        <div className="login-error">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !password}
                        className="btn-primary login-btn"
                    >
                        {isLoading ? "Bezig..." : "Inloggen"}
                    </button>
                </form>

                <div className="login-footer">
                    <Link to="/" className="back-link">Terug naar home</Link>
                </div>
            </div>
        </div>
    );
}
