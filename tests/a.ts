import { a, b } from './b'
import { version } from 'typescript'

export const c = 1

export const d = a + b + c

console.log(d, version)
