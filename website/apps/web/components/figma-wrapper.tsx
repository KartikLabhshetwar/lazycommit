"use client";

import * as React from "react";

import { cn } from "~/styles/utils";

export type FigmaWrapperProps = React.HTMLAttributes<HTMLDivElement>;

export function FigmaWrapper({ className, children }: FigmaWrapperProps) {
  const wrapper = React.useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = React.useState({
    width: 0,
    height: 0,
  });

  React.useEffect(() => {
    if (!wrapper.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(wrapper.current);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={wrapper} className={cn("relative select-none", className)}>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <div className="bg-primary text-primary-foreground absolute -top-6 left-0 z-10 inline-flex px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
          {dimensions.width.toFixed(2)} x {dimensions.height.toFixed(2)}
        </div>
      )}
      {children && (
        <div className="border-input border border-dashed">{children}</div>
      )}
    </div>
  );
}
