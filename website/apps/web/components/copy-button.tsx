"use client";

import * as React from "react";

import { motion } from "motion/react";

import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { cn } from "~/styles/utils";
import { AnimatePresence } from "motion/react";

export interface CopyButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  content: string;
  delay?: number;
}

export function CopyButton({
  className,
  content,
  delay = 3000,
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    if (!content) return;
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), delay);
      })
      .catch(() => {});
  }, [content, delay]);

  const Icon = isCopied ? Tick02Icon : Copy01Icon;

  return (
    <button
      className={cn(
        "text-muted-foreground flex shrink-0 items-center justify-center transition-colors outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onClick={handleCopy}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={isCopied ? "check" : "copy"}
          data-slot="copy-button-icon"
          initial={{ scale: 0, opacity: 0.4, filter: "blur(4px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          exit={{ scale: 0, opacity: 0.4, filter: "blur(4px)" }}
          transition={{ duration: 0.25 }}
        >
          <HugeiconsIcon icon={Icon} strokeWidth={1.5} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
