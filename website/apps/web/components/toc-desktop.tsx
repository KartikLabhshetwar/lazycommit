"use client";

import * as React from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { TextAlignLeftIcon } from "@hugeicons/core-free-icons";

import { ScrollArea, ScrollViewport } from "~/components/ui/scroll-area";

import { ScrollProvider, TOCItem, useTOC } from "~/components/toc";

import { cn } from "~/styles/utils";

export function TOCDesktop() {
  const toc = useTOC();

  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className="sticky top-28 flex w-[286px] max-w-full shrink-0 flex-col gap-3 self-start pe-4 pt-12 pb-2 max-xl:hidden">
      <div className="text-muted-foreground flex items-center gap-2">
        <HugeiconsIcon
          className="size-3.5 shrink-0"
          icon={TextAlignLeftIcon}
          strokeWidth={1.5}
        />
        <span>On this page</span>
      </div>
      <div className="flex flex-col gap-2">
        <ScrollArea>
          <ScrollProvider containerRef={containerRef}>
            <ScrollViewport
              ref={containerRef}
              className="relative max-h-[60vh] min-h-0"
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
      </div>
    </div>
  );
}
