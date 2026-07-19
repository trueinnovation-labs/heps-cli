import process from "node:process";
// Binding proof — readHepsPackageV2 + validateHepsPackageV2 used in Gate 6
import { readHepsPackageV2, validateHepsPackageV2 } from "@hub/heps-core";
void readHepsPackageV2;
void validateHepsPackageV2;

export async function main(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
heps check [dir]

Validates a HEPS v2 package using @hub/heps-core.
Prints READY or BLOCKED with per-file error details.

Arguments:
  dir   Package directory. Default: current directory

Exit codes:
  0  READY  — package is valid
  1  BLOCKED — validation errors found
`);
    return;
  }
  console.error("\nheps check: not yet implemented.\n");
  process.exit(1);
}
