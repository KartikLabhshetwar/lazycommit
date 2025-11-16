import * as React from "react";

import Link from "next/link";

import * as motion from "motion/react-client";

import { InstallCommand } from "~/components/install-command";
import { GithubStars } from "~/components/github-stars";
import { NpmDownloads } from "~/components/npm-downloads";

import { cn } from "~/styles/utils";

import type { Route } from "next";

export default function Page() {
  const variants = {
    initial: { opacity: 0, filter: "blur(8px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
  };

  return (
    <main className="grid min-h-dvh place-items-center">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between">
            <motion.p
              className="text-muted-foreground/80 font-mono select-none"
              initial="initial"
              animate="animate"
              variants={variants}
              transition={{ duration: 0.6, delay: 2.5 }}
            >
              v1.0.17 is out!
            </motion.p>
            <motion.div
              className="flex items-center gap-4"
              initial="initial"
              animate="animate"
              variants={variants}
              transition={{ duration: 0.6, delay: 2.5 }}
            >
              <React.Suspense fallback={<NpmDownloads />}>
                <NpmDownloads />
              </React.Suspense>
              <React.Suspense fallback={<GithubStars />}>
                <GithubStars />
              </React.Suspense>
            </motion.div>
          </div>
          <motion.div
            className="text-muted-foreground/50 text-3xl font-[450] select-none"
            initial="initial"
            animate="animate"
            transition={{ staggerChildren: 0.18 }}
          >
            {["Never write a commit message", "again!"].map((line, i) => (
              <motion.p key={`line-${i}`} className="flex">
                {line.split(" ").map((word, j) => (
                  <motion.span
                    key={`word-${j}`}
                    className={cn(
                      i === 1 && j === 0 && "text-secondary-foreground",
                    )}
                    variants={variants}
                    transition={{ duration: 0.8 }}
                  >
                    {word}
                    {j < line.split(" ").length - 1 && <span>&nbsp;</span>}
                  </motion.span>
                ))}
                {i === 0 && <br />}
              </motion.p>
            ))}
          </motion.div>
        </div>
        <motion.div
          className="mt-4"
          initial="initial"
          animate="animate"
          variants={variants}
          transition={{ duration: 0.6, delay: 2 }}
        >
          <InstallCommand />
        </motion.div>
        <motion.div
          className="text-muted-foreground/80 [&_a]:hover:text-secondary-foreground flex justify-between gap-2 font-mono [&_a]:transition-colors [&_a]:outline-none"
          initial="initial"
          animate="animate"
          variants={variants}
          transition={{ duration: 0.6, delay: 2.5 }}
        >
          <Link href={"/docs" as Route}>[docs]</Link>
          <div className="flex items-center gap-2">
            <Link href="https://github.com/KartikLabhshetwar/lazycommit">[github]</Link>
            <Link href="https://www.npmjs.com/package/lazycommitt">
              [npm]
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
