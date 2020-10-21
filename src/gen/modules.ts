import * as ts from 'typescript'
import { hasExportModifier } from '../utils'
import {
  BundleInfo,
  FileBundleInfo,
  Module,
  ModuleBundleInfo,
  ModuleKind
} from '../types'
import { BundleContextIdentifiers, Identifiers } from '../constants'

function createModuleFunction(body: ts.Statement[]) {
  return ts.factory.createFunctionExpression(
    undefined,
    undefined,
    undefined,
    undefined,
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        undefined,
        BundleContextIdentifiers.Require
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        undefined,
        Identifiers.Module
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        undefined,
        BundleContextIdentifiers.Exports
      )
    ],
    undefined,
    ts.factory.createBlock(body)
  )
}

function bundleFile(
  absPath: string,
  info: FileBundleInfo,
  fileDeps: Map<string, [string, Module][]>,
  module2IdMap: Map<string, number>
) {
  const deps = fileDeps.get(absPath)!

  return ts.factory.createPropertyAssignment(
    ts.factory.createNumericLiteral(module2IdMap.get(absPath)!),
    ts.factory.createArrayLiteralExpression([
      createModuleFunction(
        info.sourceFile.statements.flatMap((stmt) => {
          if (
            ts.isImportDeclaration(stmt) &&
            stmt.importClause &&
            stmt.importClause.namedBindings &&
            ts.isNamedImports(stmt.importClause.namedBindings)
          ) {
            return stmt.importClause.namedBindings.elements.map((elem) => {
              return ts.factory.createVariableStatement(
                undefined,
                ts.factory.createVariableDeclarationList([
                  ts.factory.createVariableDeclaration(
                    elem.name,
                    undefined,
                    undefined,
                    ts.factory.createPropertyAccessExpression(
                      ts.factory.createCallExpression(
                        ts.factory.createIdentifier(
                          BundleContextIdentifiers.Require
                        ),
                        undefined,
                        [stmt.moduleSpecifier]
                      ),
                      elem.name
                    )
                  )
                ])
              )
            })
          }

          if (hasExportModifier(stmt)) {
            switch (stmt.kind) {
              case ts.SyntaxKind.VariableStatement:
                const variableStmt = stmt as ts.VariableStatement
                return variableStmt.declarationList.declarations.flatMap(
                  (decl) => {
                    return [
                      ts.factory.createVariableStatement(
                        undefined,
                        ts.factory.createVariableDeclarationList([decl])
                      ),
                      ts.factory.createExpressionStatement(
                        ts.factory.createAssignment(
                          ts.factory.createPropertyAccessExpression(
                            ts.factory.createIdentifier(
                              BundleContextIdentifiers.Exports
                            ),
                            decl.name as ts.Identifier
                          ),
                          decl.name as ts.Identifier
                        )
                      )
                    ]
                  }
                )
              default:
                throw new Error('Unsupported export')
            }
          }

          return stmt
        })
      ),
      ts.factory.createObjectLiteralExpression(
        deps.map(([specifier, moduleInfo]) => {
          return ts.factory.createPropertyAssignment(
            ts.factory.createStringLiteral(specifier),
            ts.factory.createNumericLiteral(
              module2IdMap.get(
                moduleInfo.kind === ModuleKind.file
                  ? moduleInfo.absPath
                  : moduleInfo.name
              )!
            )
          )
        })
      )
    ])
  )
}

function bundleModule(
  name: string,
  module: ModuleBundleInfo,
  module2IdMap: Map<string, number>
): ts.PropertyAssignment {
  return ts.factory.createPropertyAssignment(
    ts.factory.createNumericLiteral(module2IdMap.get(name)!),
    ts.factory.createArrayLiteralExpression([
      createModuleFunction([
        ts.factory.createExpressionStatement(
          ts.factory.createAssignment(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(Identifiers.Module),
              Identifiers.Exports
            ),
            ts.factory.createCallExpression(
              ts.factory.createIdentifier(Identifiers.Require),
              undefined,
              [ts.factory.createStringLiteral(module.name)]
            )
          )
        )
      ]),
      ts.factory.createObjectLiteralExpression([])
    ])
  )
}

export function bundleModules(
  absPathOrName: string,
  info: BundleInfo,
  fileDeps: Map<string, [string, Module][]>,
  module2IdMap: Map<string, number>
): ts.PropertyAssignment {
  return info.kind === ModuleKind.file
    ? bundleFile(absPathOrName, info, fileDeps, module2IdMap)
    : bundleModule(absPathOrName, info, module2IdMap)
}
