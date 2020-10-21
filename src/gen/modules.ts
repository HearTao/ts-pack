import * as ts from 'typescript'
import { hasExportModifier } from '../utils'

export function bundleModules(
  absPath: string,
  sourceFile: ts.SourceFile,
  fileDeps: Map<string, [string, string][]>,
  file2IdMap: Map<string, number>
): ts.PropertyAssignment {
  const deps = fileDeps.get(absPath)!

  return ts.factory.createPropertyAssignment(
    ts.factory.createNumericLiteral(file2IdMap.get(absPath)!),
    ts.factory.createArrayLiteralExpression([
      ts.factory.createFunctionExpression(
        undefined,
        undefined,
        undefined,
        undefined,
        [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            'require'
          ),
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            'module'
          ),
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            'exports'
          )
        ],
        undefined,
        ts.factory.createBlock(
          sourceFile.statements.flatMap((stmt) => {
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
                          ts.factory.createIdentifier('require'),
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
                              ts.factory.createPropertyAccessExpression(
                                ts.factory.createIdentifier('module'),
                                'exports'
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
        )
      ),
      ts.factory.createObjectLiteralExpression(
        deps.map(([modifier, absDepPath]) => {
          return ts.factory.createPropertyAssignment(
            ts.factory.createStringLiteral(modifier),
            ts.factory.createNumericLiteral(file2IdMap.get(absDepPath)!)
          )
        })
      )
    ])
  )
}
