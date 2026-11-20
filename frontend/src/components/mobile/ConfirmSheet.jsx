/* Reusable bottom-sheet confirmation (replaces window.confirm).
   Desktop keeps its own dialogs; this is for the app-like flows. */
import { useEffect, useState } from "react";
import api from "../services/api";

export function ConfirmSheet({ open, title, message, confirmLabel = "Confirm", danger = false, requireReason = false, busy: busyProp, onClose, onConfirm }) {
    const [reason, setReason] = useState("");
    useEffect(() => { if (open) setReason(""); }, [open]);
    if (!open) return null;
    return (
        <div className="m-sheet-backdrop" onClick={onClose}>
            <div className="m-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="m-sheet-handle" />
                <div className="m-sheet-head"><h3>{title}</h3><button type="button" onClick={onClose}>✕</button></div>
                <div className="m-sheet-body">
                    {message && <p style={{ fontSize: 13, color: "#607080", whiteSpace: "pre-line", marginBottom: 12 }}>{message}</p>}
                    {requireReason && (
                        <label>Reason <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" /></label>
                    )}
                    <div className="m-sheet-actions">
                        <button type="button" className={"m-btn " + (danger ? "m-btn-danger" : "m-btn-primary")} onClick={() => onConfirm(reason)} disabled={busyProp || (requireReason && !reason.trim())}>
                            {busyProp ? "Working…" : confirmLabel}
                        </button>
                        <button type="button" className="m-btn m-btn-ghost" onClick={onClose}>Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* Convenience hook: manage a confirm target + reason. */
export function useConfirm() {
    const [target, setTarget] = useState(null);
    const [busy, setBusy] = useState(false);
    const confirm = async (fn) => {
        setBusy(true);
        try { await fn(); setTarget(null); }
        finally { setBusy(false); }
    };
    return { target, setTarget, busy, confirm };
}

export default ConfirmSheet;
