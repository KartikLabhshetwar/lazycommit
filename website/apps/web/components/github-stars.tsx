"use client";

import * as React from "react";

import Link from "next/link";

import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon } from "@hugeicons/core-free-icons";

import { cn } from "~/styles/utils";

const COOKIE_NAME = "github-stars";
const COOKIE_TIMESTAMP = "github-stars-timestamp";
const ONE_HOUR = 60 * 60 * 1000;

const formatStars = (count: number | null) => {
  if (!count) return null;
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count;
};

const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() ?? null;
  return null;
};

const setCookie = (name: string, value: string) => {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + ONE_HOUR).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
};

const isCacheValid = (): boolean => {
  const timestamp = getCookie(COOKIE_TIMESTAMP);
  if (!timestamp) return false;
  const cacheTime = Number.parseInt(timestamp, 10);
  return Date.now() - cacheTime < ONE_HOUR;
};

export function GithubStars() {
  const [stars, setStars] = React.useState<number | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    async function fetchStars() {
      const cachedStars = getCookie(COOKIE_NAME);
      const isValid = isCacheValid();

      if (cachedStars && isValid) {
        setStars(Number.parseInt(cachedStars, 10));
        setIsLoaded(true);
        return;
      }

      try {
        const response = await fetch(
          "https://api.github.com/repos/KartikLabhshetwar/lazycommit",
        );
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = (await response.json()) as { stargazers_count: number };
        setStars(data.stargazers_count);
        setCookie(COOKIE_NAME, data.stargazers_count.toString());
        if (typeof document !== "undefined") {
          document.cookie = `${COOKIE_TIMESTAMP}=${Date.now()}; expires=${new Date(Date.now() + ONE_HOUR).toUTCString()}; path=/; SameSite=Lax`;
        }
        setIsLoaded(true);
      } catch (error) {
        console.error("Error fetching GitHub stars:", error);
        if (cachedStars) {
          setStars(Number.parseInt(cachedStars, 10));
          setIsLoaded(true);
        }
      }
    }

    fetchStars();
  }, []);

  return (
    <Link
      className="group outline-none"
      href="https://github.com/KartikLabhshetwar/lazycommit"
    >
      <div
        className={cn(
          "text-muted-foreground/80 flex items-center gap-2 font-mono transition-opacity duration-300 select-none group-hover:underline md:text-sm",
          isLoaded ? "opacity-100" : "opacity-0",
        )}
      >
        <HugeiconsIcon className="size-4" icon={GithubIcon} strokeWidth={1.5} />
        {formatStars(stars)}
      </div>
    </Link>
  );
}
