import type { ShikiTransformer } from "shiki";

function parseMetaAttributes(metaString: string) {
  const attributes: Record<string, string> = {};
  const attributeRegex = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

  for (const match of metaString.matchAll(attributeRegex)) {
    const [, key, doubleQuoted, singleQuoted, unquoted] = match;
    attributes[key] = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
  }

  return attributes;
}

export const transformers = [
  {
    code(node) {
      if (node.tagName !== "code") return;

      const raw = this.source;
      node.properties["__raw__"] = raw;

      const meta = this.options.meta?.__raw;

      if (meta) {
        const metaAttributes = parseMetaAttributes(meta);
        Object.entries(metaAttributes).forEach(([key, value]) => {
          node.properties[`__${key}__`] = value;
        });
      }

      const packageManagerMappings = [
        {
          pattern: /^npm install\s/,
          transforms: {
            __npm__: (cmd: string) => cmd,
            __pnpm__: (cmd: string) => cmd.replace("npm install", "pnpm add"),
            __bun__: (cmd: string) => cmd.replace("npm install", "bun add"),
          },
        },
        {
          pattern: /^npx create-/,
          transforms: {
            __npm__: (cmd: string) => cmd,
            __pnpm__: (cmd: string) =>
              cmd.replace("npx create-", "pnpm create "),
            __bun__: (cmd: string) => cmd.replace("npx", "bunx --bun"),
          },
        },
        {
          pattern: /^npm create\s/,
          transforms: {
            __npm__: (cmd: string) => cmd,
            __pnpm__: (cmd: string) => cmd.replace("npm create", "pnpm create"),
            __bun__: (cmd: string) => cmd.replace("npm create", "bun create"),
          },
        },
        {
          pattern: /^npx\s/,
          transforms: {
            __npm__: (cmd: string) => cmd,
            __pnpm__: (cmd: string) => cmd.replace("npx", "pnpm dlx"),
            __bun__: (cmd: string) => cmd.replace("npx", "bunx --bun"),
          },
        },
        {
          pattern: /^npm run\s/,
          transforms: {
            __npm__: (cmd: string) => cmd,
            __pnpm__: (cmd: string) => cmd.replace("npm run", "pnpm"),
            __bun__: (cmd: string) => cmd.replace("npm run", "bun"),
          },
        },
      ];

      for (const { pattern, transforms } of packageManagerMappings) {
        if (pattern.test(raw)) {
          for (const [key, transform] of Object.entries(transforms)) {
            node.properties[key] = transform(raw);
          }
          break;
        }
      }
    },
  },
] as ShikiTransformer[];
