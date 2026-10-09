const fs = require('fs')
const src = fs.readFileSync('D:/DSH base/plugin/dsh-agent-team-plus/src/client/index.ts', 'utf8')
let depth = 0, line = 1
let inS = false, inD = false, inT = false, inLC = false, inBC = false, esc = false
for (let i = 0; i < src.length; i++) {
  const c = src[i], n = src[i + 1]
  if (inLC) { if (c === '\n') { inLC = false; line++ } continue }
  if (inBC) { if (c === '*' && n === '/') { inBC = false; i++ } if (c === '\n') line++; continue }
  if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === "'") inS = false; continue }
  if (inD) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inD = false; continue }
  if (inT) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '`') inT = false; if (c === '\n') line++; continue }
  if (c === "'") { inS = true; continue }
  if (c === '"') { inD = true; continue }
  if (c === '`') { inT = true; continue }
  if (c === '/' && n === '/') { inLC = true; continue }
  if (c === '/' && n === '*') { inBC = true; i++; continue }
  if (c === '\n') { line++; continue }
  if (c === '(' || c === '{' || c === '[') { depth++; if (depth === 2) console.log('depth2 open at line', line, ':', src.slice(i, i + 60).split('\n')[0]) }
  if (c === ')' || c === '}' || c === ']') {
    depth--; if (depth === 2) console.log('closed back to 2 at line', line)
    if (depth < 0) { console.log('EXTRA closer at line', line); process.exit(0) }
  }
}
console.log(depth === 0 ? 'balanced' : 'UNCLOSED, remaining depth ' + depth)