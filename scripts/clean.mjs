// Removes lib/ (this CLI's own compiled output) before every build.
// tsc never deletes a stale output file it no longer emits — a source
// file removed or renamed leaves its old compiled .js/.d.ts sitting in
// lib/ forever, silently shipping in the npm tarball (package.json's
// "files" includes lib/). Plain Node, not a shell command (rm -rf isn't
// portable to Windows) and not a new dependency (rimraf) for one line.
import { rmSync } from "node:fs";

rmSync(new URL("../lib", import.meta.url), { recursive: true, force: true });
