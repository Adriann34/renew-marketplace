import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

test("chat CSP allows Supabase HTTPS and secure WebSockets without broadening other origins", async () => {
  const source = ts.transpileModule(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  runInThisContext(`(function(exports) { ${source}\n})`)(exports);
  const rules = await exports.default.headers();
  const csp = rules.find((rule) => rule.source === "/:path*").headers.find((header) => header.key === "Content-Security-Policy").value;
  assert.equal(csp.split("; ").find((directive) => directive.startsWith("connect-src")),
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co");
});
