import Link from "next/link";

import {
  CodeBlockCommand,
  CodeBlockCommandProps,
} from "~/components/code-block-command";

import type { Route } from "next";

export const components = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (!props.href) return <a {...props} />;

    const isExternal = props.href.startsWith("http");

    return isExternal ? (
      <a target="_blank" rel="noopener noreferrer" {...props} />
    ) : (
      <Link href={props.href as Route} {...props} />
    );
  },
  code: ({ className, ...props }: CodeBlockCommandProps) => {
    const { __npm__: npm, __pnpm__: pnpm, __bun__: bun } = props;
    if (typeof props.children === "string") {
      <code className={className} {...props} />;
    }

    const isNpmCommand = npm && pnpm && bun;
    if (isNpmCommand) {
      return (
        <CodeBlockCommand
          className={className}
          __npm__={npm}
          __pnpm__={pnpm}
          __bun__={bun}
          {...props}
        />
      );
    }

    return <code className={className} {...props} />;
  },
};
