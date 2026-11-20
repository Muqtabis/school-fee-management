import { useEffect, useState } from "react";

// Reactive mobile detection. Uses matchMedia so rotating a phone or
// resizing a window flips the layout live (no page reload needed).
// Desktop keeps the original components; mobile gets the app-like ones.
const QUERY = "(max-width: 768px)";

export default function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== "undefined" && window.matchMedia
            ? window.matchMedia(QUERY).matches
            : false
    );

    useEffect(() => {
        if (!window.matchMedia) return;
        const mq = window.matchMedia(QUERY);
        const onChange = (e) => setIsMobile(e.matches);
        // modern + legacy listener support
        if (mq.addEventListener) mq.addEventListener("change", onChange);
        else mq.addListener(onChange);
        return () => {
            if (mq.removeEventListener) mq.removeEventListener("change", onChange);
            else mq.removeListener(onChange);
        };
    }, []);

    return isMobile;
}
