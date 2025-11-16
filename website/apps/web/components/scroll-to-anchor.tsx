"use client";

import * as React from "react";

export function ScrollToAnchor() {
  React.useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const id = decodeURIComponent(hash.replace("#", ""));

    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;

      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  return null;
}
