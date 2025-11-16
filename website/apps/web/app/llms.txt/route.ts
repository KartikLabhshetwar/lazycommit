import path from "path";
import { readFile } from "fs/promises";

import { NextResponse } from "next/server";

export async function GET() {
  const content = await readFile(
    path.join(process.cwd(), "app", "llms.txt", "llms.txt"),
    "utf-8",
  );
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain" },
  });
}
