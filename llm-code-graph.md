# CODE_GRAPH_MAP
> LLM_ONLY: DO NOT EDIT. COMPACT PROJECT MAP.

- index.js | desc: Contains 7 symbols.
  - syms: [SUPPORTED_EXTENSIONS [= [], extractSymbolsAndInheritance [(content)], generate [(cwd = process.cwd()], getIgnores [(cwd, additionalLines = [])], installHook [(cwd = process.cwd()], walk [(dir, ig)], watch [(cwd = process.cwd()]]
- test/index.test.js | desc: Contains 8 symbols.
  - syms: [AdminUser [extends BaseUser], IRepository [implements IBase], MyWidget [: StatelessWidget], ignored [by subdir/.gitignore], included [.js'), 'function included()], noDocFunc [(arg1: string, arg2: number)], realFunction [()], testFunc [This is a test function]]

## GRAPH EDGES
[AdminUser] -> [inherits] -> [BaseUser]
[IRepository] -> [inherits] -> [IBase]
[MyWidget] -> [inherits] -> [StatelessWidget]
[index.js] -> [imports] -> [chokidar]
[index.js] -> [imports] -> [dependencies]
[index.js] -> [imports] -> [fs]
[index.js] -> [imports] -> [ignore]
[index.js] -> [imports] -> [new]
[index.js] -> [imports] -> [path]
[index.js] -> [imports] -> [url]
[test/index.test.js] -> [imports] -> [../index.js]
[test/index.test.js] -> [imports] -> [./local-file]
[test/index.test.js] -> [imports] -> [assert]
[test/index.test.js] -> [imports] -> [fs]
[test/index.test.js] -> [imports] -> [header.h]
[test/index.test.js] -> [imports] -> [node]
[test/index.test.js] -> [imports] -> [other-module]
[test/index.test.js] -> [imports] -> [path]
[test/index.test.js] -> [imports] -> [test]
[test/index.test.js] -> [imports] -> [url]