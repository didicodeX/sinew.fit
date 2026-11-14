"use client";

import { useEffect } from "react";

/** Pages the app needs offline at the gym. Cached once the user is signed in. */
const OFFLINE_PAGES = ["/", "/session", "/program"];

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => reg.active?.postMessage({ type: "WARM", urls: OFFLINE_PAGES }))
      .catch(() => {
        // Non-fatal: the app still works online
      });
  }, []);
  return null;
}
