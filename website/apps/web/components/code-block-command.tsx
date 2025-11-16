"use client";

import * as React from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerTerminal02Icon } from "@hugeicons/core-free-icons";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";

import { CopyButton } from "~/components/copy-button";

type PackageManager = "npm" | "pnpm" | "bun" | "brew";

export interface CodeBlockCommandProps extends React.ComponentProps<"pre"> {
  __npm__?: string;
  __pnpm__?: string;
  __bun__?: string;
  __brew__?: string;
}

export function CodeBlockCommand({
  className,
  children,
  ...props
}: CodeBlockCommandProps) {
  const { __npm__: npm, __pnpm__: pnpm, __bun__: bun, __brew__: brew } = props;

  const [packageManager, setPackageManager] =
    React.useState<PackageManager>("npm");

  const tabs = React.useMemo(() => {
    return {
      npm: npm,
      pnpm: pnpm,
      bun: bun,
      brew: brew,
    };
  }, [npm, pnpm, bun, brew]);

  return (
    <div className="-my-3.5 overflow-x-auto">
      <Tabs
        className="gap-0"
        defaultValue={packageManager}
        onValueChange={(value) => setPackageManager(value as PackageManager)}
      >
        <div className="border-border/60 flex items-center gap-2.5 border-b px-4 py-1 font-mono">
          <HugeiconsIcon
            className="text-muted-foreground size-4"
            icon={ComputerTerminal02Icon}
            strokeWidth={1.5}
          />
          <div className="flex-grow">
            <TabsList className="bg-transparent">
              {Object.entries(tabs)
                .filter(([, value]) => value !== undefined)
                .map(([key]) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="text-muted-foreground data-[state=active]:text-foreground text-xs"
                  >
                    {key}
                  </TabsTrigger>
                ))}
            </TabsList>
          </div>
          <CopyButton content={tabs[packageManager] as string} />
        </div>
        <div className="no-scrollbar overflow-x-auto">
          {Object.entries(tabs).map(([key, value]) => (
            <TabsContent key={key} value={key} className="mt-0 px-4 py-3.5">
              <code className="!text-foreground" data-language="bash">
                {value}
              </code>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
