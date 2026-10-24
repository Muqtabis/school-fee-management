// =====================================================
// GLOBAL NOTIFICATION + CONFIRM SERVICE
//
// Replaces browser-native alert()/window.confirm() with
// app-styled popups rendered by <DialogHost /> (mounted once
// in App.js).
//
//   toast(message [, kind])          ->Transient toast (auto-dismiss)
//   confirmDialog({...}) -> Promise - centered modal, resolves
//                                       true on Confirm, false on
//                                       Cancel / Esc / backdrop.
// =====================================================

let seq = 0;

const toastSubs = new Set();
const confirmSubs = new Set();

// Best-effort tone detection for plain toast(message) calls
// (bulk-converted alert() call sites have no kind argument).
function inferKind(message) {
    const m = (message || "").toLowerCase();
    if (
        m.includes("success") ||
        m.includes("successfully") ||
        m.includes("saved") ||
        m.includes("created") ||
        m.includes("copied") ||
        m.includes("restore") ||
        m.includes("published") ||
        m.includes("assigned") ||
        m.includes("reversed") ||
        m.includes("locked") ||
        m.includes("unlocked") ||
        m.includes("added") ||
        m.includes("updated") ||
        m.includes("deleted") ||
        m.includes("archived")
    ) {
        return "success";
    }
    if (
        m.includes("unable") ||
        m.includes("error") ||
        m.includes("failed") ||
        m.includes("fail") ||
        m.includes("wrong") ||
        m.includes("invalid") ||
        m.includes("not found") ||
        m.includes("required") ||
        m.includes("cannot") ||
        m.includes("must")
    ) {
        return "danger";
    }
    if (m.includes("no data") || m.includes("none") || m.includes("already")) {
        return "warning";
    }
    return "info";
}

export function toast(message, kind) {
    const entry = {
        id: ++seq,
        message: String(message ?? ""),
        kind: kind || inferKind(String(message ?? "")),
        at: Date.now()
    };
    toastSubs.forEach((fn) => {
        try { fn(entry); } catch (e) { /* listener must never break caller */ }
    });
    return entry;
}

export function confirmDialog({
    title = "Are you sure?",
    message = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false
} = {}) {
    return new Promise((resolve) => {
        const request = {
            id: ++seq,
            title,
            message,
            confirmLabel,
            cancelLabel,
            danger,
            resolve
        };
        confirmSubs.forEach((fn) => {
            try { fn(request); } catch (e) { /* ignore */ }
        });
    });
}

export function subscribeToast(fn) {
    toastSubs.add(fn);
    return () => toastSubs.delete(fn);
}

export function subscribeConfirm(fn) {
    confirmSubs.add(fn);
    return () => confirmSubs.delete(fn);
}
