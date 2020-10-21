import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

function hasExport(stmt: ts.Statement) {
    if (!stmt.modifiers) return false

    return stmt.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
}

export function pack(entry: string): string {
    const files: string[] = [entry]
    const sourceFiles = new Map<string, ts.SourceFile>()
    const fileDeps = new Map<string, [string, string, ts.ImportDeclaration][]>()
    const file2IdMap = new Map<string, number>()

    let id = 0
    while (files.length) {
        const file = files.shift()!;
        const absPath = resolveFile(file)
        if (sourceFiles.has(absPath)) {
            continue
        }

        file2IdMap.set(absPath, ++id)

        const content = fs.readFileSync(absPath).toString();
        const sourceFile = ts.createSourceFile(absPath, content, ts.ScriptTarget.Latest)
        sourceFiles.set(absPath, sourceFile)

        visitImportDeclaration(absPath, sourceFile)
    }

    return bundle()

    function bundle() {
        const result: ts.PropertyAssignment[] = []
        sourceFiles.forEach((value, key) => {
            result.push(bundleSourceFile(key, value))
        })

        const modules = ts.factory.createObjectLiteralExpression(result)
        const resultCode = createResolver(modules)
        const printer = ts.createPrinter()
        const resultFile = ts.factory.updateSourceFile(
            ts.createSourceFile('', '', ts.ScriptTarget.Latest),
            [ts.factory.createExpressionStatement(
                resultCode
            )]
        )
        const code = printer.printFile(resultFile)

        return code
    }

    function createResolver(modules: ts.ObjectLiteralExpression) {
        return ts.factory.createImmediatelyInvokedFunctionExpression([
            ts.factory.createFunctionDeclaration(
                undefined,
                undefined,
                undefined,
                ts.factory.createIdentifier("require"),
                undefined,
                [ts.factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    undefined,
                    "id",
                )],
                undefined,
                ts.factory.createBlock(
                    [
                        ts.factory.createVariableStatement(
                            undefined,
                            ts.factory.createVariableDeclarationList(
                                [ts.createVariableDeclaration(
                                    ts.factory.createArrayBindingPattern([
                                        ts.factory.createBindingElement(
                                            undefined,
                                            undefined,
                                            ts.createIdentifier("fn"),
                                        ),
                                        ts.factory.createBindingElement(
                                            undefined,
                                            undefined,
                                            ts.createIdentifier("mapping"),
                                        )
                                    ]),
                                    undefined,
                                    ts.factory.createElementAccessExpression(
                                        ts.factory.createIdentifier("modules"),
                                        ts.factory.createIdentifier("id")
                                    )
                                )],
                                ts.NodeFlags.Const
                            )
                        ),
                        ts.factory.createFunctionDeclaration(
                            undefined,
                            undefined,
                            undefined,
                            "localRequire",
                            undefined,
                            [ts.factory.createParameterDeclaration(
                                undefined,
                                undefined,
                                undefined,
                                "relativePath",
                            )],
                            undefined,
                            ts.factory.createBlock(
                                [ts.factory.createReturnStatement(ts.factory.createCallExpression(
                                    ts.factory.createIdentifier("require"),
                                    undefined,
                                    [ts.factory.createElementAccessExpression(
                                        ts.factory.createIdentifier("mapping"),
                                        ts.factory.createIdentifier("relativePath")
                                    )]
                                ))],
                                true
                            )
                        ),
                        ts.factory.createVariableStatement(
                            undefined,
                            ts.factory.createVariableDeclarationList(
                                [ts.createVariableDeclaration(
                                    ts.factory.createIdentifier("module"),
                                    undefined,
                                    ts.factory.createObjectLiteralExpression(
                                        [ts.factory.createPropertyAssignment(
                                            ts.factory.createIdentifier("exports"),
                                            ts.factory.createObjectLiteralExpression(
                                                [],
                                                false
                                            )
                                        )],
                                        false
                                    )
                                )],
                                ts.NodeFlags.Const
                            )
                        ),
                        ts.factory.createExpressionStatement(ts.factory.createCallExpression(
                            ts.factory.createIdentifier("fn"),
                            undefined,
                            [
                                ts.factory.createIdentifier("localRequire"),
                                ts.factory.createIdentifier("module"),
                                ts.factory.createPropertyAccessExpression(
                                    ts.factory.createIdentifier("module"),
                                    ts.factory.createIdentifier("exports")
                                )
                            ]
                        )),
                        ts.factory.createReturnStatement(ts.createPropertyAccess(
                            ts.factory.createIdentifier("module"),
                            ts.factory.createIdentifier("exports")
                        ))
                    ],
                    true
                )
            ),
            ts.factory.createExpressionStatement(ts.createCall(
                ts.factory.createIdentifier("require"),
                undefined,
                [ts.factory.createNumericLiteral(1)]
            ))
        ], ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            "modules"
        ), modules)
    }

    function bundleSourceFile(absPath: string, sourceFile: ts.SourceFile): ts.PropertyAssignment {
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
                        ), ts.factory.createParameterDeclaration(
                            undefined,
                            undefined,
                            undefined,
                            'exports'
                        )
                    ],
                    undefined,
                    ts.factory.createBlock(sourceFile.statements.flatMap(stmt => {
                        if (ts.isImportDeclaration(stmt) && stmt.importClause && stmt.importClause.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
                            return stmt.importClause.namedBindings.elements.map(elem => {
                                return ts.factory.createVariableStatement(
                                    undefined,
                                    ts.factory.createVariableDeclarationList(
                                        [
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
                                        ]
                                    )
                                )
                            })
                        }

                        if (hasExport(stmt)) {
                            switch (stmt.kind) {
                                case ts.SyntaxKind.VariableStatement:
                                    const variableStmt = stmt as ts.VariableStatement;
                                    return variableStmt.declarationList.declarations.flatMap(decl => {
                                        return [
                                            ts.factory.createVariableStatement(
                                                undefined,
                                                ts.factory.createVariableDeclarationList(
                                                    [decl]
                                                )
                                            ),
                                            ts.factory.createExpressionStatement(
                                                ts.factory.createAssignment(
                                                    ts.factory.createPropertyAccessExpression(
                                                        ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("module"), "exports"),
                                                        decl.name as ts.Identifier
                                                    ),
                                                    decl.name as ts.Identifier
                                                )
                                            )
                                        ]
                                    })
                                default:
                                    throw new Error("Unsupported export")
                            }
                        }

                        return stmt
                    }))
                ),
                ts.factory.createObjectLiteralExpression(deps.map(([modifier, absDepPath]) => {
                    return ts.factory.createPropertyAssignment(
                        ts.factory.createStringLiteral(modifier),
                        ts.factory.createNumericLiteral(file2IdMap.get(absDepPath)!)
                    )
                }))
            ])
        )
    }

    function resolveFile(file: string): string {
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

    function visitImportDeclaration(absPath: string, sourceFile: ts.SourceFile) {
        const deps: [string, string, ts.ImportDeclaration][] = []
        ts.forEachChild(sourceFile, visitor)
        fileDeps.set(absPath, deps)

        function visitor(node: ts.Node) {
            if (ts.isImportDeclaration(node)) {
                if (!ts.isStringLiteral(node.moduleSpecifier)) {
                    throw new Error("Invalid module specifier")
                }

                const absDepFile = resolveFile(path.resolve(path.dirname(absPath), node.moduleSpecifier.text));
                deps.push([node.moduleSpecifier.text, absDepFile, node])
                files.push(absDepFile)
                return
            }

            ts.forEachChild(node, visitor)
        }
    }
}