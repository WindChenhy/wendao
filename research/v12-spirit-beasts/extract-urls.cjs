const fs = require('fs')
for (const f of ['F1', 'F2', 'F3', 'F4', 'F5']) {
  const s = fs.readFileSync('research/v12-spirit-beasts/findings/' + f + '.md', 'utf8')
  const urls = [...s.matchAll(/https?:\/\/[^\s)\]"']+/g)].map((m) => m[0])
  console.log('===', f, 'urls', urls.length)
  console.log([...new Set(urls)].slice(0, 15).join('\n'))
  console.log('--- head ---')
  console.log(s.slice(0, 900))
}
