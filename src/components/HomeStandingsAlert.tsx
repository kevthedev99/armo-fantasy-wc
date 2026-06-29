"use client";

import { useEffect, useState } from "react";
import { BracketUpdateAlert } from "@/components/BracketUpdateAlert";
import { STANDINGS_ALERT_EVENT } from "@/lib/standings-alert";

/** Knockout alert — shown when the Standings home page loads or the tab is clicked. */
export function HomeStandingsAlert() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }

    function handleHash() {
      if (window.location.hash === "#standings") {
        setOpen(true);
      }
    }

    window.addEventListener(STANDINGS_ALERT_EVENT, handleOpen);
    window.addEventListener("hashchange", handleHash);

    return () => {
      window.removeEventListener(STANDINGS_ALERT_EVENT, handleOpen);
      window.removeEventListener("hashchange", handleHash);
    };
  }, []);

  return <BracketUpdateAlert open={open} onClose={() => setOpen(false)} />;
}
