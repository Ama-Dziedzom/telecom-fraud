"use client";

import { useEffect, useRef } from "react";

/**
 * Next 16 keeps visited pages alive (hidden) after navigating away, so a form
 * that navigates on success would come back still showing its spinner. Effect
 * cleanup runs when the page is hidden, so reset transient state there.
 */
export function useResetOnHide(reset: () => void) {
  const latest = useRef(reset);
  useEffect(() => {
    latest.current = reset;
  });
  useEffect(() => () => latest.current(), []);
}
