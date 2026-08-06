import { execFileSync } from "node:child_process";
import path from "node:path";

const appwriteBin = path.join(process.cwd(), "node_modules", ".bin", "appwrite");

export function runAppwriteCli(args) {
  const output = execFileSync(appwriteBin, args, {
    encoding: "utf8",
    env: process.env,
  });
  const jsonStart = output.indexOf("{");
  const jsonArrayStart = output.indexOf("[");
  const start =
    jsonStart === -1
      ? jsonArrayStart
      : jsonArrayStart === -1
        ? jsonStart
        : Math.min(jsonStart, jsonArrayStart);

  if (start === -1) {
    return output.trim();
  }

  return JSON.parse(output.slice(start));
}

export function runAppwriteCliVoid(args) {
  execFileSync(appwriteBin, args, {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
