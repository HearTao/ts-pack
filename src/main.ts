import { pack } from '.'
import * as fs from 'fs'

const result = pack('./tests/a.ts')
console.log(result)
fs.writeFileSync('./out.js', result, { encoding: 'utf-8' })
