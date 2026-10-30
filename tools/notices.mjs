// The licence texts of the code and fonts the web build ships (CREDITS.md, "Third-party
// code and libraries"), gathered from node_modules into public/THIRD-PARTY-NOTICES.txt,
// which the credits card links (TTT-5.1). Run `npm run notices` after a dependency changes.
import { readFileSync, writeFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../node_modules/${p}`, import.meta.url), "utf8");
const pkg = (name) => JSON.parse(read(`${name}/package.json`));
const notices = [
  { name: "three", file: "three/LICENSE" },
  { name: "postprocessing", file: "postprocessing/LICENSE.md" },
  // @fluent/bundle ships no licence file; its package says Apache-2.0 (Mozilla Foundation).
  { name: "@fluent/bundle", text: () => APACHE_2 },
  { name: "@fontsource-variable/fraunces", file: "@fontsource-variable/fraunces/LICENSE" },
  { name: "@fontsource/atkinson-hyperlegible", file: "@fontsource/atkinson-hyperlegible/LICENSE" },
];
const APACHE_2 = `Copyright 2017 Mozilla Foundation

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
except in compliance with the License. You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
either express or implied. See the License for the specific language governing permissions
and limitations under the License.
`;

const rule = "=".repeat(78);
const out = [
  "Noughty Crosses: third-party notices",
  "",
  "The web build ships these libraries and fonts. Each keeps its own licence, copied below",
  "from the package as installed. The game's own code and assets: see CREDITS.md and",
  "LICENSE in the source repository.",
  "",
];
for (const n of notices) {
  const { version, license } = pkg(n.name);
  out.push(
    rule,
    `${n.name} ${version} (${license})`,
    rule,
    "",
    (n.text ? n.text() : read(n.file)).trim(),
    "",
  );
}
writeFileSync(new URL("../public/THIRD-PARTY-NOTICES.txt", import.meta.url), `${out.join("\n")}\n`);
console.log(`public/THIRD-PARTY-NOTICES.txt: ${notices.length} notices`);
