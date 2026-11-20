import React from "react";
import ReactDOM from "react-dom/client";

import {
    BrowserRouter
} from "react-router-dom";

import App from "./App";

import AuthProvider
    from "./context/AuthContext";

import { UIProvider }
    from "./context/UIContext";


import "./styles/index.css";

// Platform design system (Windows / Android / iOS responsive
// layer, automatic dark mode, centered modal styles). Must
// load AFTER index.css so its overrides win.
import "./styles/platform.css";

// Mobile app chrome (bottom tab bar, sheets, cards) — loaded last.
import "./styles/mobile-app.css";

// UI polish (skeletons, focus rings, density, print) — loaded last.
import "./styles/ui-polish.css";

// Register the PWA service worker (offline shell only, no data cached).
// Never registered during local dev on non-localhost hosts to avoid
// interfering with the dev server; works on the deployed HTTPS build.
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
}


ReactDOM
    .createRoot(
        document.getElementById(
            "root"
        )
    )
    .render(

        <React.StrictMode>

            <BrowserRouter>

                <AuthProvider>

                    <UIProvider>

                        <App />

                    </UIProvider>

                </AuthProvider>

            </BrowserRouter>

        </React.StrictMode>

    );