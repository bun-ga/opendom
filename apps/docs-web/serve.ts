import { serve } from "bun";
import { join } from "path";
import { existsSync } from "fs";

// Using 5173 as the default Vocs port
const PORT = process.env.PORT || 5173;
const PUBLIC_DIR = join(process.cwd(), "public");

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // Default to index.html for root
    if (path === "/") path = "/index.html";

    let filePath = join(PUBLIC_DIR, path);

    // 1. Try exact path
    if (existsSync(filePath) && !path.endsWith("/")) {
      return new Response(Bun.file(filePath));
    }

    // 2. Try adding .html (Clean URLs support)
    const htmlPath = `${filePath.replace(/\/$/, "")}.html`;
    if (existsSync(htmlPath)) {
      return new Response(Bun.file(htmlPath));
    }

    // 3. Fallback to index.html (Standard for SSG/SPA)
    const fallbackPath = join(PUBLIC_DIR, "index.html");
    return new Response(Bun.file(fallbackPath));
  },
});

console.log(`🚀 opendom Docs live at http://localhost:${PORT}`);
