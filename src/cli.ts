import process from "node:process";

const COMMANDS = ["create", "check", "build"] as const;
type Command = (typeof COMMANDS)[number];

export async function dispatch(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (!COMMANDS.includes(command as Command)) {
    console.error(`\nUnknown command: "${command}"`);
    console.error(`Run "heps --help" for usage.\n`);
    process.exit(1);
  }

  const mod = await import(`./commands/${command}.js`);
  await (mod as { main: (args: string[]) => Promise<void> }).main(rest);
}

function printHelp(): void {
  console.log(`
heps <command> [options]

Commands:
  create <name>   Scaffold a new HEPS v2 design package
  check  [dir]    Validate a HEPS v2 package  (READY / BLOCKED, exit 0 / 1)
  build  [dir]    Package validated source for distribution

Run "heps <command> --help" for command-specific options.
`);
}
