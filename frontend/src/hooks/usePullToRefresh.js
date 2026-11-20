/* Pull-to-refresh: when at the top of a page on a touch device, pull
   down past 80px to reload the current view. Global — no page edits. */
import { useEffect, useState } from "react";

export default function usePullToRefresh() {
    const [active, setActive] = useState(false);
    useEffect(() => {
        let startY = 0;
        let pulling = false;
        const onStart = (e) => {
            if (window.scrollY <= 0 && e.touches[0]) { startY = e.touches[0].clientY; pulling = true; }
        };
        const onMove = (e) => {
            if (!pulling || !e.touches[0]) return;
            const delta = e.touches[0].clientY - startY;
            if (delta > 80 && window.scrollY <= 0) setActive(true);
        };
        const onEnd = () => {
            if (active) window.location.reload();
            pulling = false;
            setActive(false);
        };
        window.addEventListener("touchstart", onStart, { passive: true });
        window.addEventListener("touchmove", onMove, { passive: true });
        window.addEventListener("touchend", onEnd);
        return () => {
            window.removeEventListener("touchstart", onStart);
            window.removeEventListener("touchmove", onMove);
            window.removeEventListener("touchend", onEnd);
        };
    }, [active]);
    return active;
}
