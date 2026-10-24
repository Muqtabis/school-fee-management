import { useEffect, useState } from "react";
import OverlayDialog from "./OverlayDialog";

// =====================================================
// PROMPT DIALOG (replaces browser-native window.prompt)
//
// Centre-positioned, app-styled prompt/confirm popup:
//   - Esc key + backdrop click close it (OverlayDialog)
//   - Focus moves into the field on open, trapped while open
//   - Enter (or Ctrl+Enter on the multiline field) submits
//   - Optional <select> when `options` is provided
//   - Buttons reuse the classic .primary-btn/.cancel-btn look
//
// Used for reverse/archive reasons, password resets, class
// renames and fee-structure copying.
// =====================================================

const fieldStyle = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    fontFamily: "inherit",
    border: "1px solid var(--border, #D9E0E6)",
    borderRadius: "8px",
    backgroundColor: "var(--surface-soft, #fff)",
    color: "inherit",
    boxSizing: "border-box"
};

export default function PromptDialog({
    open,
    title,
    message,
    placeholder = "",
    initialValue = "",
    type = "text",
    multiline = false,
    options = null,        // [{ label, value }] or plain strings -> select
    requireValue = true,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    busy = false,
    onClose,
    onConfirm
}) {
    const [value, setValue] = useState(initialValue);

    // Reset the field every time the dialog opens.
    useEffect(() => {
        if (!open) return;
        if (options && options.length > 0) {
            const first = options[0];
            setValue(typeof first === "object" ? first.value : first);
        } else {
            setValue(initialValue);
        }
        // Field intentionally resets only when the dialog opens.
    }, [open]);

    if (!open) return null;

    const canSubmit = !busy && (!requireValue || value.trim().length > 0);

    const submit = () => {
        if (!canSubmit) return;
        onConfirm && onConfirm(value.trim());
    };

    const handleKeyDown = (e) => {
        if (e.key !== "Enter") return;
        if (multiline && !e.ctrlKey) return;
        e.preventDefault();
        submit();
    };

    const renderOption = (opt, i) => {
        const v = typeof opt === "object" ? opt.value : opt;
        const l = typeof opt === "object" ? opt.label : opt;
        return <option key={v || i} value={v}>{l}</option>;
    };

    return (
        <OverlayDialog onClose={onClose} ariaLabel={title}>
            <div
                style={{
                    width: "min(92vw, 430px)",
                    maxHeight: "80vh",
                    overflowY: "auto",
                    background: "var(--surface, #fff)",
                    color: "var(--text, #263238)",
                    border: "1px solid var(--border, #D9E0E6)",
                    borderRadius: "10px",
                    boxShadow: "0 18px 45px rgba(27, 41, 56, 0.28)",
                    padding: "20px"
                }}
            >
                <h3 style={{ margin: "0 0 6px", fontSize: "17px", color: "var(--navy, #1F3A5F)" }}>
                    {title}
                </h3>

                {message && (
                    <p style={{
                        margin: "0 0 14px",
                        fontSize: "13.5px",
                        lineHeight: 1.5,
                        color: "var(--text-secondary, #5A6771)",
                        whiteSpace: "pre-line"
                    }}>
                        {message}
                    </p>
                )}

                {options ? (
                    <select
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{ ...fieldStyle, minHeight: "42px" }}
                    >
                        {options.map(renderOption)}
                    </select>
                ) : multiline ? (
                    <textarea
                        rows={3}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        style={{ ...fieldStyle, resize: "vertical" }}
                    />
                ) : (
                    <input
                        type={type}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        style={fieldStyle}
                    />
                )}

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "18px" }}>
                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={onClose}
                        disabled={busy}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className="primary-btn"
                        onClick={submit}
                        disabled={!canSubmit}
                    >
                        {busy ? "Working..." : confirmLabel}
                    </button>
                </div>
            </div>
        </OverlayDialog>
    );
}
