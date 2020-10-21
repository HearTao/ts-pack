import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import { resolveFile } from './utils'
import { createResolver } from './gen/resolver'
import { bundleModules } from './gen/modules'

export function pack(entry: string): string {
  const files: string[] = [entry]
  const sourceFiles = new Map<string, ts.SourceFile>()
  const fileDeps = new Map<string, [string, string][]>()
  const file2IdMap = new Map<string, number>()

  analyze()

  const result = bundle()
  return print(result)

  function analyze() {
    let id = 0
    while (files.length) {
      const file = files.shift()!
      const absPath = resolveFile(file)
      if (sourceFiles.has(absPath)) {
        continue
      }

      file2IdMap.set(absPath, id++)

      const content = fs.readFileSync(absPath).toString()
      const sourceFile = ts.createSourceFile(
        absPath,
        content,
        ts.ScriptTarget.Latest
      )
      sourceFiles.set(absPath, sourceFile)

      visitImportDeclaration(absPath, sourceFile)
    }
  }

  function bundle() {
    const modules: ts.PropertyAssignment[] = []
    sourceFiles.forEach((value, key) => {
      modules.push(bundleModules(key, value, fileDeps, file2IdMap))
    })

    const modulesObject = ts.factory.createObjectLiteralExpression(modules)
    const resultCode = createResolver(modulesObject)
    return ts.factory.updateSourceFile(
      ts.createSourceFile('', '', ts.ScriptTarget.Latest),
      [ts.factory.createExpressionStatement(resultCode)]
    )
  }

  function print(result: ts.SourceFile) {
    const printer = ts.createPrinter()
    return printer.printFile(result)
  }

  function visitImportDeclaration(absPath: string, sourceFile: ts.SourceFile) {
    const deps: [string, string][] = []
    ts.forEachChild(sourceFile, visitor)
    fileDeps.set(absPath, deps)

    function visitor(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        if (!ts.isStringLiteral(node.moduleSpecifier)) {
          throw new Error('Invalid module specifier')
        }

        const absDepFile = resolveFile(
          path.resolve(path.dirname(absPath), node.moduleSpecifier.text)
        )
        deps.push([node.moduleSpecifier.text, absDepFile])
        files.push(absDepFile)
        return
      }

      ts.forEachChild(node, visitor)
    }
  }
}
