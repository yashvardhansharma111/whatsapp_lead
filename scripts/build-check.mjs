// A production build that does not disturb a running dev server.
//
// Both write to `.next`, so building while `npm run dev` is up replaces the chunks the
// open browser is still asking for. The browser reports that as a ChunkLoadError, which
// reads like broken code rather than a directory pulled out from under it.
//
// Pointing the build at its own directory keeps the two apart. Env vars cannot be set
// inline in an npm script on Windows, which is the only reason this is a file.

import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-check" },
});

process.exit(result.status ?? 1);
