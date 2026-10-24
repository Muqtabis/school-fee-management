import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// =====================================================
// PLATFORM MODAL  (Requirement 3 — centered dialogs)
//
// A single reusable centered dialog used for ALL popups:
// searches, menus, forms, confirmations. Never top-anchored.
//
// Platform conventions are handled by platform.css tokens:
//   - Android  -> Material 3 AlertDialog look (ripple, elevation)
//   - iOS      -> continuous-corner card + vibrancy backdrop
//   - Windows  -> Fluent ContentDialog look (thin scrollbar,
//                 keyboard focus ring)
//
// Behaviour:
//   - Renders CENTERED over a blurred, semi-transparent backdrop.
//   - Backdrop click dismisses.
//   - Escape key dismisses (desktop keyboard flows).
//   - Focus is trapped inside while open (WCAG focus order).
//   - Focus returns to the triggering element on close.
//   - Page behind is scroll-locked.
//
// USAGE:
//   <Modal open={open} onClose={close} title="Search" variant="">
//     ...content...
//   </Modal>
//
// `variant="cupertino"` gives iOS stacked full-width actions.
// `variant="danger"` renders the Material warning icon style.
// =====================================================

const FOCUSABLE_SELECTORS = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])'
].join(",");

export default function Modal({
    open,
    onClose,
    title,
    children,
    variant = "",
    ariaLabel,
    ariaDescription,
    hideClose
}) {
    const dialogRef = useRef(null);
    const restoreFocusRef = useRef(null);

    // Mount/unmount behaviour: focus management + scroll lock.
    useEffect(() => {
        if (!open) return;

        restoreFocusRef.current = document.activeElement;

        // Lock background scroll so the page cannot scroll under
        // the centered dialog (native dialogs never do this).
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const dialog = dialogRef.current;

        // Initial focus goes to the first focusable element, or the
        // dialog itself (keyboard-only and screen-reader friendly).
        if (dialog) {
            const focusables = dialog.querySelectorAll(FOCUSABLE_SELECTORS);
            const target = focusables.length ? focusables[0] : dialog;
            try {
                target.focus({ preventScroll: true });
            } catch (e) {
                // Non-focusable content: ignore, dialog still traps Tab.
            }
        }

        return () => {
            document.body.style.overflow = prevOverflow;
            if (
                restoreFocusRef.current &&
                typeof restoreFocusRef.current.focus === "function" &&
                document.contains(restoreFocusRef.current)
            ) {
                restoreFocusRef.current.focus();
            }
        };
    }, [open]);

    // Keyboard handling: Escape closes; Tab is trapped (req. 3).
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose(e);
                return;
            }
            if (e.key === "Tab") {
                const dialog = dialogRef.current;
                if (!dialog) return;
                const focusables = Array.from(
                    dialog.querySelectorAll(FOCUSABLE_SELECTORS)
                ).filter((el) => el.offsetParent !== null);

                if (focusables.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = focusables[0];
                const last = focusables[focusables.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                } else if (!dialog.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    // Backdrop click: only closes when the click STARTS and ENDS on
    // the backdrop itself (prevents drag-out-of-dialog dismissal).
    const onBackdropMouseDown = (e) => {
        if (e.target === e.currentTarget) {
            e.currentTarget._backdownOK = true;
        }
    };
    const onBackdropClick = (e) => {
        if (e.target === e.currentTarget && e.currentTarget._backdownOK) {
            onClose(e);
        }
        e.currentTarget._backdownOK = false;
    };

    return createPortal(
        <div
            className={"platform-modal-backdrop" + (variant ? " " + variant : "")}
            onClick={onBackdropClick}
            onMouseDown={onBackdropMouseDown}
        >
            <div
                ref={dialogRef}
                className={"platform-modal-dialog" + (variant ? " " + variant : "")}
                role="dialog"
                aria-modal="true"
                aria-label={title ? undefined : ariaLabel}
                aria-labelledby={title ? "platform-modal-title" : undefined}
                aria-describedby={ariaDescription ? "platform-modal-desc" : undefined}
                tabIndex={-1}
            >
                {(title || !hideClose) && (
                    <div className="platform-modal-header">
                        <h2 id="platform-modal-title">
                            {variant.includes("danger") ? "⚠ " : ""}
                            {title}
                        </h2>
                        {!hideClose && (
                            <button
                                type="button"
                                className="platform-modal-close"
                                onClick={onClose}
                                aria-label="Close dialog"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                )}

                <div id="platform-modal-desc" style={{ display: "none" }} />

                <div className="platform-modal-body">{children}</div>
            </div>
        </div>,
        document.body
    );
}
