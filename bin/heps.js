#!/usr/bin/env node
import { dispatch } from "../dist/cli.js";

dispatch(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
