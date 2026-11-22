/**
 * Tiny safe calculator for case math: numbers, + - * /, parentheses, and a
 * trailing % on a number (5% = 0.05). No eval().
 */

type Token = { t: 'num'; v: number } | { t: 'op'; v: '+' | '-' | '*' | '/' } | { t: 'lp' } | { t: 'rp' }

function tokenize(src: string): Token[] {
  const out: Token[] = []
  const s = src.replace(/[,\s$]/g, '').replace(/[x×]/gi, '*').replace(/÷/g, '/')
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (/[0-9.]/.test(ch)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      let v = Number(s.slice(i, j))
      if (Number.isNaN(v)) throw new Error('Bad number')
      if (s[j] === '%') {
        v /= 100
        j++
      } else if (/[kKmMbB]/.test(s[j] ?? '')) {
        v *= { k: 1e3, m: 1e6, b: 1e9 }[s[j].toLowerCase() as 'k' | 'm' | 'b']
        j++
      }
      out.push({ t: 'num', v })
      i = j
    } else if ('+-*/'.includes(ch)) {
      out.push({ t: 'op', v: ch as '+' | '-' | '*' | '/' })
      i++
    } else if (ch === '(') {
      out.push({ t: 'lp' })
      i++
    } else if (ch === ')') {
      out.push({ t: 'rp' })
      i++
    } else {
      throw new Error(`Unexpected "${ch}"`)
    }
  }
  return out
}

/** Recursive descent: expr = term (('+'|'-') term)*, term = factor (('*'|'/') factor)*. */
export function evaluate(src: string): number {
  const tokens = tokenize(src)
  let pos = 0
  const peek = () => tokens[pos]

  function factor(): number {
    const tok = tokens[pos++]
    if (!tok) throw new Error('Incomplete expression')
    if (tok.t === 'num') return tok.v
    if (tok.t === 'op' && tok.v === '-') return -factor()
    if (tok.t === 'op' && tok.v === '+') return factor()
    if (tok.t === 'lp') {
      const v = expr()
      if (tokens[pos++]?.t !== 'rp') throw new Error('Missing )')
      return v
    }
    throw new Error('Unexpected operator')
  }
  function term(): number {
    let v = factor()
    for (let tok = peek(); tok?.t === 'op' && (tok.v === '*' || tok.v === '/'); tok = peek()) {
      pos++
      const rhs = factor()
      v = tok.v === '*' ? v * rhs : v / rhs
    }
    return v
  }
  function expr(): number {
    let v = term()
    for (let tok = peek(); tok?.t === 'op' && (tok.v === '+' || tok.v === '-'); tok = peek()) {
      pos++
      const rhs = term()
      v = tok.v === '+' ? v + rhs : v - rhs
    }
    return v
  }

  const result = expr()
  if (pos !== tokens.length) throw new Error('Unexpected input')
  if (!Number.isFinite(result)) throw new Error('Not a finite number')
  return result
}
