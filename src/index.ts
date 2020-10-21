import * as fs from 'fs'
import * as ts from 'typescript'
import { resolveFile, resolveModuleName } from './utils'
import { createResolver } from './gen/resolver'
import { bundleModules } from './gen/modules'
import { BundleInfo, Module, ModuleKind, Options } from './types'

export function pack(entry: string, options?: Options): string {
  const moduleInfos: Module[] = [
    {
      kind: ModuleKind.file,
      absPath: resolveFile(entry)
    }
  ]
  const bundles = new Map<string, BundleInfo>()
  const fileDeps = new Map<string, [string, Module][]>()
  const module2IdMap = new Map<string, number>()

  analyze()
  const result = bundle()
  return print(result)

  function analyze() {
    let id = 0
    while (moduleInfos.length) {
      const moduleInfo = moduleInfos.shift()!
      if (moduleInfo.kind === ModuleKind.module) {
        if (bundles.has(moduleInfo.name)) {
          continue
        }
        module2IdMap.set(moduleInfo.name, id++)
        bundles.set(moduleInfo.name, {
          kind: ModuleKind.module,
          name: moduleInfo.name
        })
      } else {
        if (bundles.has(moduleInfo.absPath)) {
          continue
        }

        module2IdMap.set(moduleInfo.absPath, id++)
        const content = fs.readFileSync(moduleInfo.absPath).toString()
        const sourceFile = ts.createSourceFile(
          moduleInfo.absPath,
          content,
          ts.ScriptTarget.Latest
        )
        bundles.set(moduleInfo.absPath, {
          kind: ModuleKind.file,
          absPath: moduleInfo.absPath,
          sourceFile
        })
        visitImportDeclaration(moduleInfo.absPath, sourceFile)
      }
    }
  }

  function bundle() {
    const modules: ts.PropertyAssignment[] = []
    bundles.forEach((value, key) => {
      modules.push(bundleModules(key, value, fileDeps, module2IdMap))
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
    const deps: [string, Module][] = []
    ts.forEachChild(sourceFile, visitor)
    fileDeps.set(absPath, deps)

    function visitor(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        if (!ts.isStringLiteral(node.moduleSpecifier)) {
          throw new Error('Invalid module specifier')
        }

        const moduleInfo = resolveModuleName(node.moduleSpecifier.text, absPath)
        if (moduleInfo.kind === ModuleKind.file) {
          deps.push([node.moduleSpecifier.text, moduleInfo])
        } else {
          deps.push([moduleInfo.name, moduleInfo])
        }
        moduleInfos.push(moduleInfo)
        return
      }

      ts.forEachChild(node, visitor)
    }
  }
}
