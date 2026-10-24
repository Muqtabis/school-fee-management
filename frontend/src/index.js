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