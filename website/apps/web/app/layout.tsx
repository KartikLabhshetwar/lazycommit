import "~/styles/globals.css";

import { callingCode, geistMono, geistSans } from "~/styles/fonts";

import { Databuddy } from "@databuddy/sdk/react";

import { cn } from "~/styles/utils";

import { config } from "~/config";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    template: `%s · ${config.site.title}`,
    default: config.site.title,
  },
  description: config.site.description,
  creator: config.site.creator,
  keywords: config.site.keywords,
  authors: config.site.authors,
  openGraph: {
    title: config.site.title,
    siteName: config.site.title,
    description: config.site.description,
    url: config.site.url,
    type: "website",
    images: [
      {
        url: config.site.ogImage,
        width: 1200,
        height: 630,
        alt: config.site.title,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: config.site.title,
    description: config.site.description,
    site: config.site.url,
    creator: config.site.creator,
    images: [config.site.ogImage],
  },
};

export const viewport: Viewport = {
  colorScheme: "only light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Databuddy
        clientId="reT8eU-VUrTZIcCJMddD_"
        trackHashChanges={true}
        trackScrollDepth={true}
        trackPerformance={false}
        enableBatching={true}
      />
      <body
        className={cn(
          callingCode.variable,
          geistSans.variable,
          geistMono.variable,
        )}
      >
        {children}
      </body>
    </html>
  );
}
