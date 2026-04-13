# CODE_GRAPH_MAP
> LLM_ONLY: DO NOT EDIT. COMPACT PROJECT MAP.

- index.js | desc: Contains 5 symbols.
  - syms: [SUPPORTED_EXTENSIONS [= [], extractSymbolsAndInheritance [(content)], generate [(cwd = process.cwd()], getIgnores [(cwd, additionalLines = [])], walk [(dir, ig)]]
- test/index.test.js

## GRAPH EDGES
[index.js] -> [imports] -> [chokidar]
[index.js] -> [imports] -> [fs]
[index.js] -> [imports] -> [ignore]
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