// Downloads the pinned protoc-gen-grpc-web release binary for this platform
// into node_modules/.tools/protoc-gen-grpc-web, verifying its checksum. Run
// automatically by `npm install` / `npm ci` (postinstall).
//
// There's no maintained npm package that ships the 2.x plugin, so we fetch the
// official release from https://github.com/grpc/grpc-web/releases. Keep
// VERSION in sync with the grpc-web runtime version in package.json.

import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "2.1.1";
const SHA256 = {
  "linux-x86_64":
    "d7f0000b84ecebceeb317204f60dc2716708f9276d11ae8b4b5d3a10af49d65f",
  "linux-aarch64":
    "e95f306f16c17cac80280e0964c0095073433232f94b025fe41652a0eeacbaea",
  "darwin-aarch64":
    "3e1dbc5a440d869a5b1ac9fe4240d59db47c993c7279443ae6b4c0fd7faafd89",
};

const arch = { x64: "x86_64", arm64: "aarch64" }[process.arch];
const platform = `${process.platform}-${arch}`;

// Upstream's 2.1.1 darwin-x86_64 asset is actually an arm64 Mach-O (it has
// the same hash as darwin-aarch64), so it can't run on Intel Macs. A manually
// installed binary is accepted as-is.
const manualDest = new URL(
  "../node_modules/.tools/protoc-gen-grpc-web",
  import.meta.url
);
if (platform === "darwin-x86_64") {
  if (existsSync(manualDest)) {
    process.exit(0);
  }
  console.error(
    `protoc-gen-grpc-web: the upstream ${VERSION} darwin-x86_64 release is ` +
      "an arm64 binary and won't run on Intel Macs. Install " +
      `protoc-gen-grpc-web ${VERSION} another way (e.g. build it from ` +
      "source) and copy it to node_modules/.tools/protoc-gen-grpc-web."
  );
  process.exit(1);
}

const sha256 = SHA256[platform];
if (!sha256) {
  console.error(`protoc-gen-grpc-web: unsupported platform ${platform}`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "node_modules", ".tools", "protoc-gen-grpc-web");
const hash = (buf) => createHash("sha256").update(buf).digest("hex");

if (existsSync(dest) && hash(readFileSync(dest)) === sha256) {
  process.exit(0);
}

const url =
  `https://github.com/grpc/grpc-web/releases/download/${VERSION}/` +
  `protoc-gen-grpc-web-${VERSION}-${platform}`;
console.log(`protoc-gen-grpc-web: downloading ${url}`);
const resp = await fetch(url);
if (!resp.ok) {
  console.error(
    `protoc-gen-grpc-web: download failed: ${resp.status} ${resp.statusText}`
  );
  process.exit(1);
}
const buf = Buffer.from(await resp.arrayBuffer());
if (hash(buf) !== sha256) {
  console.error(`protoc-gen-grpc-web: checksum mismatch for ${url}`);
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, buf);
chmodSync(dest, 0o755);
