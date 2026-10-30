// The Linux Steam build as one folder that runs inside the Steam Linux Runtime (TTT-4.3.3).
// The runtime's containers have no WebKitGTK, so this starts from the AppImage's AppDir,
// which bundles it, and puts the Steam binary in place of the plain one. The AppDir leaves
// out a few base libraries that it expects on the host; the runtime's copies are too old
// for the bundled Pango and libgcrypt, so they are bundled too. The bundled gdk-pixbuf
// finds no image loaders inside a container, so the runtime's own is used.
// Run after `npm run desktop` (the AppDir) and `npm run desktop:steam` (the Steam binary).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const release = "src-tauri/target/release";
const appDir = path.join(release, "bundle/appimage/Noughty Crosses.AppDir");
const out = path.join(release, "steam-linux");
const hostLib = "/usr/lib/x86_64-linux-gnu";
const fromHost = [
  "libharfbuzz.so.0",
  "libfreetype.so.6",
  "libfontconfig.so.1",
  "libgpg-error.so.0",
];

if (!fs.existsSync(appDir)) throw new Error(`${appDir} is missing: run npm run desktop first`);
const steamLib = path.join(release, "libsteam_api.so");
if (!fs.existsSync(steamLib))
  throw new Error(`${steamLib} is missing: run npm run desktop:steam first`);

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(appDir, out, { recursive: true, verbatimSymlinks: true });

const bin = path.join(out, "usr/bin/noughty-crosses");
fs.copyFileSync(path.join(release, "noughty-crosses"), bin);
fs.copyFileSync(steamLib, path.join(out, "usr/lib/libsteam_api.so"));
execFileSync("patchelf", ["--set-rpath", "$ORIGIN/../lib", bin]);

for (const lib of fromHost)
  fs.copyFileSync(path.join(hostLib, lib), path.join(out, "usr/lib", lib));
for (const f of fs.readdirSync(path.join(out, "usr/lib"))) {
  if (f.startsWith("libgdk_pixbuf-2.0.so")) fs.rmSync(path.join(out, "usr/lib", f));
}
const hook = path.join(out, "apprun-hooks/linuxdeploy-plugin-gtk.sh");
const text = fs.readFileSync(hook, "utf8");
const patched = text.replace(/^export GDK_PIXBUF_MODULE_FILE=.*$/m, "unset GDK_PIXBUF_MODULE_FILE");
if (patched === text) throw new Error(`${hook}: GDK_PIXBUF_MODULE_FILE line not found`);
fs.writeFileSync(hook, patched);

console.log(`${out}: start it with AppRun`);
