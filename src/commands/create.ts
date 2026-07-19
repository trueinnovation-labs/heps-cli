import process from "node:process";

export async function main(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
heps create <name>

Scaffolds a new HEPS v2 design package from the built-in starter template.

Arguments:
  name              Package name, e.g. my-brand

Options:
  --namespace <ns>  Package ID namespace. Default: hub.pack
`);
    return;
  }
  console.error("\nheps create: not yet implemented.\n");
  process.exit(1);
}
