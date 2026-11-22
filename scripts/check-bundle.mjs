// Fails if any hidden case data leaked into the browser bundle.
// Run after `vite build`: node scripts/check-bundle.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Snippets of hidden CONTENT, one or more per case: facts, answers, model answers.
// (Not field names: the scorecard legitimately reads fields like
// `modelRecommendation` from an attempt once the server has written them.)
const SECRETS = [
  'MidStates Logistics', // Harvest Lane: the hidden root cause
  'Fix the supply chain, not pricing', // Harvest Lane: model recommendation
  '150 vans has signaled', // VoltPath: hidden anchor-customer fact
  'Enter, but phased', // VoltPath: model recommendation
  '233.33', // VoltPath: exact answer
  'about 8x ARR for companies under 10% churn', // Clarion: hidden comps fact
  'Offer about $36-40M', // Clarion: model recommendation
]
const files = []
const walk = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))))
walk('dist/client')
const leaks = files.flatMap((f) => SECRETS.filter((s) => readFileSync(f, 'utf8').includes(s)).map((s) => `${f}: "${s}"`))
if (leaks.length) {
  console.error('Hidden case data found in the client bundle:\n' + leaks.join('\n'))
  process.exit(1)
}
console.log(`OK: ${files.length} client files checked, no hidden case data.`)
