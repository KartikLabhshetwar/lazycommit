import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";

import { z } from "zod";

import remarkGfm from "remark-gfm";
import remarkEmoji from "remark-emoji";
import remarkFlexibleToc from "remark-flexible-toc";

import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";

import { transformers } from "~/lib/transformers";

import type { Options as MDXOptions } from "@content-collections/mdx";
import type { TocItem, FlexibleTocOptions } from "remark-flexible-toc";
import type { Options as RehypePrettyCodeOptions } from "rehype-pretty-code";

import type { TOCItem } from "~/components/toc";

const docs = defineCollection({
  name: "docs",
  directory: "content/docs",
  include: "**/*.md",
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
  transform: async (doc, { cache }) => {
    const filePath = doc._meta.filePath.replace(/\.mdx?$/, "");
    const slugs = filePath.split("/").filter(Boolean);

    const { mdx, toc } = await cache(doc.content, async () => {
      let toc: TOCItem[] = [];

      const mdxOptions = {
        remarkPlugins: [
          remarkGfm,
          remarkEmoji,
          [
            remarkFlexibleToc,
            {
              callback: (items: TocItem[]) => {
                toc = items.map((item) => ({
                  title: item.value,
                  url: item.href,
                  depth: item.depth,
                }));
              },
            } as FlexibleTocOptions,
          ],
        ],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypePrettyCode,
            {
              defaultLang: "plaintext",
              theme: "github-light",
              keepBackground: false,
              transformers: transformers,
            } as RehypePrettyCodeOptions,
          ],
        ],
      } as MDXOptions;

      const mdx = await compileMDX(
        {
          cache: (input, compute) => Promise.resolve(compute(input)),
        },
        doc,
        mdxOptions,
      );

      return {
        mdx,
        toc,
      };
    });

    return {
      ...doc,
      mdx,
      toc,
      slugs,
    };
  },
});

export default defineConfig({
  collections: [docs],
});
