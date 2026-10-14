// Run a command with no console window, writing its output to a file, for long runs started in the background.
import { spawn } from "node:child_process";
import { appendFileSync, closeSync, openSync } from "node:fs";

const HELP = `Run a command with no console window, writing its output to a file.

  npm run hidden -- OUT -- COMMAND [ARGS ...]

On Windows a program started without a console gets a terminal window of its own, which flashes up on the owner's
screen; this starts the command with none. Start this itself hidden (Start-Process node -WindowStyle Hidden).
OUT gets the command's output, then a last line \`exit N\`. Exit codes: the command's own, 2 bad arguments.`;

function main(): Promise<number> {
  const args = process.argv.slice(2);
  const split = args.indexOf("--");
  if (args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return Promise.resolve(0);
  }
  const out = args[0];
  const command = args.slice(split + 1);
  if (split !== 1 || !out || !command.length) {
    console.error(HELP);
    return Promise.resolve(2);
  }
  const fd = openSync(out, "w");
  const child = spawn(command[0] as string, command.slice(1), {
    stdio: ["ignore", fd, fd],
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
  });
  return new Promise((done) =>
    child.on("close", (code) => {
      closeSync(fd);
      appendFileSync(out, `\nexit ${code ?? 1}\n`);
      done(code ?? 1);
    }),
  );
}

process.exitCode = await main();
