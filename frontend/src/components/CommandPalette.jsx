/* Command palette (top search / Ctrl+K) — results come from the app's real
   page registry: pages AND their dialogs/actions, plus live student data. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { APP_PAGES } from "../config/pages";
import api from "../services/api";

export default function CommandPalette() {
    const navigate = useNavigate();
    const { canAccess } = useAuth();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [students, setStudents] = useState([]);
    const inputRef = useRef(null);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((v) => !v);
                setQ("");
            } else if (e.key === "Escape") setOpen(false);
        };
        const onOpen = () => { setOpen(true); setQ(""); };
        window.addEventListener("keydown", onKey);
        window.addEventListener("open-search", onOpen);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("open-search", onOpen);
        };
    }, []);

    useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

    useEffect(() => {
        if (!open || q.trim().length < 2) { setStudents([]); return; }
        const t = setTimeout(() => {
            api.get("/students", { params: { search: q.trim(), limit: 8 } })
                .then((r) => setStudents(Array.isArray(r.data) ? r.data.slice(0, 6) : []))
                .catch(() => setStudents([]));
        }, 220);
        return () => clearTimeout(t);
    }, [open, q]);

    const needle = q.trim().toLowerCase();
    const allowed = useMemo(() => APP_PAGES.filter((p) => canAccess(p.key)), [canAccess]);

    // Pages — only after the user types. Ranked: label > description > path.
    const pages = useMemo(() => {
        if (!needle) return [];
        return allowed
            .map((p) => {
                const label = p.label.toLowerCase();
                const hay = `${label} ${(p.description || "").toLowerCase()} ${(p.group || "").toLowerCase()} ${p.path}`;
                let score = label.startsWith(needle) ? 3 : label.includes(needle) ? 2 : hay.includes(needle) ? 1 : 0;
                return { page: p, score };
            })
            .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 6).map((x) => x.page);
    }, [allowed, needle]);

    // Dialogs/actions — flattened from each page's real `actions` metadata.
    const actions = useMemo(() => {
        const all = allowed.flatMap((p) => (p.actions || []).map((name) => ({ name, label: p.label, path: p.path, icon: p.icon })));
        if (!needle) return [];
        return all.filter((a) =>
            a.name.toLowerCase().includes(needle) || a.label.toLowerCase().includes(needle)
        ).slice(0, 8);
    }, [allowed, needle]);

    if (!open) return null;
    const go = (path) => { setOpen(false); navigate(path); };
    const empty = pages.length === 0 && actions.length === 0 && students.length === 0;

    return (
        <div className="cmd-backdrop" onClick={() => setOpen(false)}>
            <div className="cmd-panel" onClick={(e) => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    className="cmd-input"
                    placeholder="Search pages, actions or students…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <div className="cmd-body">
                    {actions.length > 0 && <div className="cmd-label">Actions &amp; Dialogs</div>}
                    {actions.map((a, i) => (
                        <button type="button" key={"a" + i} className="cmd-item" onClick={() => go(a.path)}>
                            <span>✦</span>
                            <span className="cmd-item-text">
                                <strong>{a.name}</strong>
                                <small>{a.label}</small>
                            </span>
                        </button>
                    ))}
                    {pages.length > 0 && <div className="cmd-label">Pages</div>}
                    {pages.map((p) => (
                        <button type="button" key={p.key} className="cmd-item" onClick={() => go(p.path)}>
                            <span>{p.icon}</span>
                            <span className="cmd-item-text">
                                <strong>{p.label}</strong>
                                <small>{p.description || p.path}</small>
                            </span>
                        </button>
                    ))}
                    {students.length > 0 && <div className="cmd-label">Students</div>}
                    {students.map((s) => (
                        <button type="button" key={s.id} className="cmd-item" onClick={() => go("/students")}>
                            <span>◉</span>
                            <span className="cmd-item-text">
                                <strong>{s.studentName}{s.rollNumber ? ` · Roll ${s.rollNumber}` : ""}</strong>
                                <small>{s.className || ""}</small>
                            </span>
                        </button>
                    ))}
                    {empty && (
                        <div className="cmd-empty">
                            {needle ? "No matches. Try a page, action or student name." : "Type to search pages, actions or students…"}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
