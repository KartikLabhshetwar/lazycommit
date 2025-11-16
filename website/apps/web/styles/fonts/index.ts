import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import localFont from "next/font/local";

export const geistSans = GeistSans;
export const geistMono = GeistMono;

export const callingCode = localFont({
  variable: "--font-calling-code",
  src: "./calling-code.woff2",
});
