import { useEffect, useRef } from "react";

// =====================================================
// LEGACY MODAL BEHAVIOR HOOK
//
// Requirement 3: every popup must behave like a native
// dialog. The app already has hand-rolled overlay dialogs
// (.modal-overlay flex-centered, see index.css), so instead
// of rewriting each one, this hook upgrades them in place:
//
//   - Escape key closes the dialog (Windows/desktop flows)
//   - Clicking the BACKDROP only (not inner content) closes
//   - Focus is trapped inside while open (accessibility)
//   - Page scroll is locked while open
//   - Focus returns to the triggering element on close
//
// Centering itself is enforced by platform.css (.modal-overlay
// is forced to flex-center), so even unrefactored popups can
// never render off-center or top-anchored.
//
// USAGE:
//   const { overlayRef, contentRef, handleOverlayClick } =
//       useModalBehavior(onClose);
//   <div className="modal-overlay ref={overlayRef}"
//        onClick={handleOverlayClick}>
//     <div className="xxx-modal" ref={contentRef}> ... </div>
//   </div>
// =====================================================

const FOCUSABLE_SELECTORS = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])'
].join(",");

export default function useModalBehavior(onClose) {
    const overlayRef = useRef(null);
    const contentRef = useRef(null);
    const restoreFocusRef = useRef(null);

    useEffect(() => {
        restoreFocusRef.current = document.activeElement;

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const content = contentRef.current;
        if (content) {
            const focusables = content.querySelectorAll(FOCUSABLE_SELECTORS);
            if (focusables.length > 0) {
                try {
                    focusables[0].focus({ preventScroll: true });
                } catch (e) {
                    // Ignore non-focusable first element.
                }
            }
        }

        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose && onClose(e);
                return;
            }
            if (e.key === "Tab" && content) {
                const focusables = Array.from(
                    content.querySelectorAll(FOCUSABLE_SELECTORS)
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
                } else if (!content.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = prevOverflow;
            if (
                restoreFocusRef.current &&
                typeof restoreFocusRef.current.focus === "function" &&
                document.contains(restoreFocusRef.current)
            ) {
                restoreFocusRef.current.focus();
            }
        };
    }, []);

    // Backdrop-only dismissal (clicks inside the dialog body are
    // ignored so text selection does not close the dialog).
    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current) {
            onClose && onClose(e);
        }
    };

    return { overlayRef, contentRef, handleOverlayClick };
}
