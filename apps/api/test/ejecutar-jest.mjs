import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"

const require = createRequire(import.meta.url)
const resultado = spawnSync(
  process.execPath,
  ["--experimental-vm-modules", require.resolve("jest/bin/jest"), ...process.argv.slice(2)],
  { stdio: "inherit" },
)
if (resultado.error) throw resultado.error
process.exit(resultado.status ?? 1)
