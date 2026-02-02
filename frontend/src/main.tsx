import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

if ("serviceWorker" in navigator) {
    registerSW({
        immediate: true,
        onRegisterError(error) {
            console.error("Service worker registration failed:", error);
        }
    });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
