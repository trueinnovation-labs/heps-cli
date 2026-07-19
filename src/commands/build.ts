import process from "node:process";

export async function main(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
heps build [dir]

Validates and packages a HEPS v2 source package for distribution.
Output directory: dist/<package-id>-<version>/

The HUB compiles and installs — this command only validates and copies.

Arguments:
  dir   Package directory. Default: current directory
`);
    return;
  }
  console.error("\nheps build: not yet implemented.\n");
  process.exit(1);
}
