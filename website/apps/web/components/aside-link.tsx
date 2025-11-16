"use client";

import * as React from "react";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { cn } from "~/styles/utils";

export function AsideLink({
  className,
  href,
  children,
}: Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string;
}) {
  const pathname = usePathname();
  const isActive = href === pathname;

  return (
    <Link
      className={cn(
        "text-muted-foreground hover:text-foreground data-[active]:text-foreground flex w-full items-center gap-2 transition-colors",
        className,
      )}
      href={{ pathname: href }}
      data-active={isActive || undefined}
    >
      {children}
    </Link>
  );
}
