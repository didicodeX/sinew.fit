"use client";

import { useEffect } from "react";
import { startSyncLoop } from "@lib/local/sync";

export function SyncLoop() {
  useEffect(() => startSyncLoop(), []);
  return null;
}
