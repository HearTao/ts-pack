import * as ts from 'typescript'

export interface Options {
  externals: Record<string, string>
}

export enum ModuleKind {
  module,
  file
}

export interface IModule {
  kind: ModuleKind.module
  name: string
}

export interface IFile {
  kind: ModuleKind.file
  absPath: string
}

export type Module = IModule | IFile

export interface FileBundleInfo {
  kind: ModuleKind.file
  absPath: string
  sourceFile: ts.SourceFile
}

export interface ModuleBundleInfo {
  kind: ModuleKind.module
  name: string
}

export type BundleInfo = FileBundleInfo | ModuleBundleInfo
