// Copies the Steamworks library beside the Steam build's binary (TTT-4.3.2). The
// steamworks-sys crate ships Valve's redistributable; cargo metadata says where it is.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const meta = JSON.parse(
  execFileSync(
    "cargo",
    [
      "metadata",
      "--format-version",
      "1",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--features",
      "steam",
    ],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  ),
);
const sys = meta.packages.find((p) => p.name === "steamworks-sys");
if (!sys) throw new Error("steamworks-sys is not in src-tauri's dependencies");

const [dir, file] =
  process.platform === "win32" ? ["win64", "steam_api64.dll"] : ["linux64", "libsteam_api.so"];
const from = path.join(path.dirname(sys.manifest_path), "lib/steam/redistributable_bin", dir, file);
const to = path.join("src-tauri/target/release", file);
fs.copyFileSync(from, to);
console.log(`${from} -> ${to}`);
