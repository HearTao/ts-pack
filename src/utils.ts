import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

export function resolveFile(file: string): string {
  const absPath = path.resolve(file)
  if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
    return absPath
  }

  const postfixAbsPath = `${absPath}.ts`
  if (fs.existsSync(postfixAbsPath) && fs.statSync(postfixAbsPath).isFile()) {
    return postfixAbsPath
  }

  const indexAbsPath = path.join(absPath, 'index.ts')
  if (fs.existsSync(indexAbsPath) && fs.statSync(indexAbsPath).isFile()) {
    return indexAbsPath
  }

  throw new Error('Cannot find ' + file)
}

export function hasExportModifier(stmt: ts.Statement) {
  if (!stmt.modifiers) return false

  return stmt.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}
