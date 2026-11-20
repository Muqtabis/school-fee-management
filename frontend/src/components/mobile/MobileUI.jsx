/* Shared mobile UI primitives — card lists, bottom sheets, stat tiles. */
import { useEffect } from "react";

export function MobileSheet({ open, onClose, title, children }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="m-sheet-backdrop" onClick={onClose}>
            <div className="m-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="m-sheet-handle" />
                <div className="m-sheet-head">
                    <h3>{title}</h3>
                    <button type="button" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="m-sheet-body">{children}</div>
            </div>
        </div>
    );
}

export function MobileCard({ title, value, sub, tone = "", onClick, children }) {
    const Tag = onClick ? "button" : "div";
    return (
        <Tag className={"m-card" + (tone ? " m-card-" + tone : "")} onClick={onClick} type={onClick ? "button" : undefined}>
            {title && <span className="m-card-title">{title}</span>}
            <strong className="m-card-value">{value}</strong>
            {sub && <small className="m-card-sub">{sub}</small>}
            {children}
        </Tag>
    );
}

export function MobileList({ children, empty = "Nothing here yet." }) {
    if (!children || (Array.isArray(children) && children.length === 0)) {
        return <div className="m-empty">{empty}</div>;
    }
    return <div className="m-list">{children}</div>;
}

export function MobileRow({ label, value, sub, action }) {
    return (
        <div className="m-row">
            <div className="m-row-main">
                <strong>{label}</strong>
                {sub && <small>{sub}</small>}
            </div>
            <div className="m-row-side">
                {value != null && <span>{value}</span>}
                {action}
            </div>
        </div>
    );
}

export function MobileSegmented({ options, value, onChange }) {
    return (
        <div className="m-segmented">
            {options.map((o) => (
                <button
                    type="button"
                    key={o.value}
                    className={value === o.value ? "m-seg-active" : ""}
                    onClick={() => onChange(o.value)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function MobileFab({ onClick, label = "+" }) {
    return (
        <button type="button" className="m-fab" onClick={onClick} aria-label="Add">
            {label}
        </button>
    );
}
