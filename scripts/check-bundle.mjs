// Fails if any hidden case data leaked into the browser bundle.
// Run after `vite build`: node scripts/check-bundle.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SECRETS = ['MidStates Logistics', 'structureCheckpoints', 'modelRecommendation', 'LTV = ARPA', '233.33']
const files = []
const walk = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))))
walk('dist/client')
const leaks = files.flatMap((f) => SECRETS.filter((s) => readFileSync(f, 'utf8').includes(s)).map((s) => `${f}: "${s}"`))
if (leaks.length) {
  console.error('Hidden case data found in the client bundle:\n' + leaks.join('\n'))
  process.exit(1)
}
console.log(`OK: ${files.length} client files checked, no hidden case data.`)
