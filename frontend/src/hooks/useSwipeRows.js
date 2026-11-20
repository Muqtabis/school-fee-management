/* Swipe-to-reveal row actions (touch devices). Attaches to a row and
   toggles a .swipe-open class; CSS reveals the action strip. */
import { useEffect } from "react";

export default function useSwipeRows(selector, onTrigger) {
    useEffect(() => {
        let startX = 0, startY = 0, activeRow = null;
        const onStart = (e) => {
            if (!e.touches[0]) return;
            activeRow = e.target.closest(selector);
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };
        const onEnd = (e) => {
            if (!activeRow || !e.changedTouches[0]) return;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
                document.querySelectorAll(`${selector}.swipe-open`).forEach((r) => r.classList.remove("swipe-open"));
                activeRow.classList.add("swipe-open");
                if (onTrigger) onTrigger(activeRow);
            }
            activeRow = null;
        };
        window.addEventListener("touchstart", onStart, { passive: true });
        window.addEventListener("touchend", onEnd);
        return () => {
            window.removeEventListener("touchstart", onStart);
            window.removeEventListener("touchend", onEnd);
        };
    }, [selector, onTrigger]);
}
