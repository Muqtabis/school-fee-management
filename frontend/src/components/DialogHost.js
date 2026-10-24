import { useEffect, useRef, useState } from "react";
import OverlayDialog from "./OverlayDialog";
import { subscribeToast, subscribeConfirm } from "../services/notify";

// =====================================================
// DIALOG HOST (mounted once, next to <Routes> in App.js)
//
// Renders every global popup produced by services/notify.js:
//   - toast(): stacked bottom-right toasts (bottom-centre-ish
//     on small screens), auto-dismiss after ~4.2s
//   - confirmDialog(): centred confirm modal (Esc / backdrop
//     = Cancel), styled like the rest of the app
// =====================================================

export default function DialogHost() {
    const [toasts, setToasts] = useState([]);
    const [confirms, setConfirms] = useState([]);
    const timersRef = useRef([]);

    useEffect(() => {
        const unsubToast = subscribeToast((t) => {
            setToasts((cur) => [...cur, t]);
            const timer = setTimeout(() => {
                setToasts((cur) => cur.filter((x) => x.id !== t.id));
            }, 4200);
            timersRef.current.push(timer);
        });

        const unsubConfirm = subscribeConfirm((req) => {
            setConfirms((cur) => [...cur, req]);
        });

        return () => {
            unsubToast();
            unsubConfirm();
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        };
    }, []);

    const settle = (request, answer) => {
        setConfirms((cur) => cur.filter((x) => x.id !== request.id));
        try {
            request.resolve(answer);
        } catch (e) {
            /* resolver gone — nothing to do */
        }
    };

    const current = confirms[0] || null;

    return (
        <>
            {current && (
                <OverlayDialog
                    onClose={() => settle(current, false)}
                    ariaLabel={current.title}
                >
                    <div
                        className="app-dialog-card"
                        role="alertdialog"
                        aria-modal="true"
                        aria-label={current.title}
                    >
                        <h3 className="app-dialog-title">{current.title}</h3>
                        {current.message && (
                            <p className="app-dialog-message">{current.message}</p>
                        )}
                        <div className="app-dialog-actions">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => settle(current, false)}
                            >
                                {current.cancelLabel || "Cancel"}
                            </button>
                            <button
                                type="button"
                                className={current.danger ? "app-dialog-danger-btn" : "primary-btn"}
                                onClick={() => settle(current, true)}
                            >
                                {current.confirmLabel || "Confirm"}
                            </button>
                        </div>
                    </div>
                </OverlayDialog>
            )}

            <div className="app-toast-stack" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`app-toast app-toast-${t.kind}`} role="status">
                        {t.message}
                    </div>
                ))}
            </div>
        </>
    );
}
