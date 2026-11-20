/* Warn before leaving a page with unsaved form changes. */
import { useEffect } from "react";

export default function useUnsavedGuard(dirty) {
    useEffect(() => {
        if (!dirty) return;
        const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);
}
