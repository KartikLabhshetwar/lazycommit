"use client";

import * as React from "react";

import Link from "next/link";

import scrollIntoView from "scroll-into-view-if-needed";

import { useAnchorObserver } from "~/hooks/use-anchor-observer";
import { useOnChange } from "~/hooks/use-on-change";

import type { Route } from "next";

export type TOCItem = {
  title: string;
  url: string;
  depth: number;
};

export type TableOfContents = TOCItem[];

const ActiveAnchorContext = React.createContext<string[]>([]);

const TOCContext = React.createContext<TableOfContents>([]);

const ScrollContext = React.createContext<React.RefObject<HTMLElement | null>>({
  current: null,
});

export function useActiveAnchor(): string | undefined {
  return React.useContext(ActiveAnchorContext).at(-1);
}

export function useActiveAnchors(): string[] {
  return React.useContext(ActiveAnchorContext);
}

export function useTOC(): TableOfContents {
  return React.useContext(TOCContext);
}

export interface AnchorProviderProps {
  toc: TableOfContents;
  single?: boolean;
  children?: React.ReactNode;
}

export interface ScrollProviderProps {
  containerRef: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode;
}

export function ScrollProvider({
  containerRef,
  children,
}: ScrollProviderProps) {
  return (
    <ScrollContext.Provider value={containerRef}>
      {children}
    </ScrollContext.Provider>
  );
}

export function AnchorProvider({
  toc,
  single = true,
  children,
}: AnchorProviderProps) {
  const headings = React.useMemo(
    () => toc.map((item) => item.url.slice(1)),
    [toc],
  );

  return (
    <TOCContext.Provider value={toc}>
      <ActiveAnchorContext.Provider value={useAnchorObserver(headings, single)}>
        {children}
      </ActiveAnchorContext.Provider>
    </TOCContext.Provider>
  );
}

export interface TOCItemProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  onActiveChange?: (v: boolean) => void;
}

export function TOCItem({ href, onActiveChange, ...props }: TOCItemProps) {
  const anchorRef = React.useRef<HTMLAnchorElement | null>(null);

  const containerRef = React.useContext(ScrollContext);

  const anchors = useActiveAnchors();

  const isActive = anchors.includes(href.slice(1));

  useOnChange(isActive, (v) => {
    const element = anchorRef.current;
    if (!element) return;

    if (v && containerRef.current) {
      scrollIntoView(element, {
        behavior: "smooth",
        block: "center",
        inline: "center",
        scrollMode: "always",
        boundary: containerRef.current,
      });
    }

    onActiveChange?.(v);
  });

  return (
    <Link
      ref={anchorRef}
      data-active={isActive || undefined}
      href={href as Route}
      {...props}
    >
      {props.children}
    </Link>
  );
}
