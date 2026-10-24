import useModalBehavior from "./useModalBehavior";

// =====================================================
// OVERLAY DIALOG WRAPPER
//
// Upgrades legacy hand-rolled overlays to Requirement 3
// behaviour (centered dialog + Escape + backdrop dismiss +
// focus trap + scroll lock + ARIA) wherever the modal markup
// is embedded inline inside a page component (FeesPage,
// ExpensesPage, StudentsPage) and hooks cannot be called on
// the page itself.
//
// Centre-positioning + platform visuals come from
// platform.css (.modal-overlay + .overlay-dialog-content).
// =====================================================

export default function OverlayDialog({
    onClose,
    className = "modal-overlay",
    ariaLabel,
    children
}) {
    const { overlayRef, contentRef, handleOverlayClick } = useModalBehavior(onClose);

    return (
        <div className={className} ref={overlayRef} onClick={handleOverlayClick}>
            <div
                ref={contentRef}
                className="overlay-dialog-content"
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                tabIndex={-1}
            >
                {children}
            </div>
        </div>
    );
}
