"use client";

import * as React from "react";

import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  TextAlignLeftIcon,
} from "@hugeicons/core-free-icons";

import { ScrollArea, ScrollViewport } from "~/components/ui/scroll-area";

import { useOnClickOutside } from "~/hooks/use-on-click-outside";

import {
  ScrollProvider,
  TOCItem,
  useActiveAnchor,
  useTOC,
} from "~/components/toc";

import { cn } from "~/styles/utils";

export function TOCMobile() {
  const toc = useTOC();
  const active = useActiveAnchor();

  const outsideRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [open, setOpen] = React.useState(false);

  useOnClickOutside(outsideRef, () => setOpen(false));

  const current = React.useMemo(() => {
    return toc.find((item) => active === item.url.slice(1))?.title;
  }, [toc, active]);

  return (
    <div
      ref={outsideRef}
      className="sticky top-16 z-10 h-10 overflow-visible xl:hidden"
    >
      <header className="bg-background/90 border-b px-6 backdrop-blur-md">
        <button
          className="w-full py-2.5 text-start"
          onClick={() => setOpen(!open)}
        >
          <div className="text-muted-foreground flex items-center gap-2">
            <HugeiconsIcon
              className="size-3.5 shrink-0"
              icon={TextAlignLeftIcon}
              strokeWidth={1.5}
            />
            <span className="shrink-0">On this page</span>
            <HugeiconsIcon
              className={cn(
                open ? "rotate-90" : "-ms-1.5",
                "size-4 shrink-0 transition-all",
              )}
              icon={ArrowRight01Icon}
              strokeWidth={1.5}
            />
            <span
              className={cn(
                "text-muted-foreground -ms-1.5 truncate transition-opacity",
                (!current || open) && "opacity-0",
              )}
            >
              {current}
            </span>
          </div>
        </button>
        <MotionConfig transition={{ duration: 0.4, type: "spring", bounce: 0 }}>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="relative overflow-hidden"
              >
                <motion.div className="bg-background/10 pb-4 backdrop-blur-md">
                  <ScrollArea>
                    <ScrollProvider containerRef={containerRef}>
                      <ScrollViewport
                        ref={containerRef}
                        className="no-scrollbar relative max-h-[50dvh] min-h-0"
                      >
                        <div className="flex flex-col gap-2">
                          {toc.map((item: TOCItem) => (
                            <TOCItem
                              key={item.url}
                              href={item.url}
                              className={cn(
                                item.depth !== 2 && "ml-4",
                                "text-muted-foreground data-[active]:text-secondary-foreground",
                              )}
                            >
                              {item.title}
                            </TOCItem>
                          ))}
                        </div>
                      </ScrollViewport>
                    </ScrollProvider>
                  </ScrollArea>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </MotionConfig>
      </header>
    </div>
  );
}
