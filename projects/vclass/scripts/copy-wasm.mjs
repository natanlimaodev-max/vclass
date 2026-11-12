// Copies sql.js's WASM file into public/ so the browser can load it for the Anki export.
import { copyFileSync, mkdirSync } from "fs";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);
const src = require.resolve("sql.js/dist/sql-wasm.wasm");
const dest = path.join(path.dirname(new URL(import.meta.url).pathname), "../public/sql-wasm.wasm");
mkdirSync(path.dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`copied ${path.relative(process.cwd(), src)} -> public/sql-wasm.wasm`);
