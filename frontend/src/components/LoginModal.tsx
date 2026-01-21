import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./LoginModal.module.css";
import buttonStyles from "./Button.module.css";
import formStyles from "./Form.module.css";

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
        <div className={styles.loginOverlay}>
            <div className={styles.loginModal}>
                <div className={styles.loginHeader}>
                    <h2>Inloggen</h2>
                    <p>Voer het wachtwoord in om toegang te krijgen tot de admin pagina's.</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.loginForm}>
                    <div className={`${styles.formGroup} ${formStyles.formGroup}`}>
                        <label htmlFor="password">Wachtwoord</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Voer wachtwoord in"
                            autoFocus
                            disabled={isLoading}
                            className={formStyles.loginInput}
                        />
                    </div>

                    {error && (
                        <div className={styles.loginError}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !password}
                        className={`${buttonStyles.btnPrimary} ${buttonStyles.btnLogin}`}
                    >
                        {isLoading ? "Bezig..." : "Inloggen"}
                    </button>
                </form>

                <div className={styles.loginFooter}>
                    <Link to="/" className={`${buttonStyles.backLink} ${styles.loginFooterBackLink}`}>Terug naar home</Link>
                </div>
            </div>
        </div>
    );
}
