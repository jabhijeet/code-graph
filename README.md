# CODE-GRAPH

A language-agnostic, ultra-compact codebase mapper designed specifically for LLM agents to optimize context and token usage. It doesn't just list files; it provides a high-signal "map" of your project's architecture, including descriptions and signatures.

## Features
- **Structural Knowledge Graph:** Captures relationships between files and classes:
  - **Dependencies:** Tracks `imports`, `requires`, and `includes` across files.
  - **Inheritance:** Maps `extends`, `implements`, and class hierarchies.
- **Smart Context Extraction:** Captures JSDoc, Python docstrings, and preceding comments.
- **Signature Fallback:** Extracts function signatures (parameters/types) if documentation is missing.
- **Recursive .gitignore Support:** Deeply respects both root and nested `.gitignore` files.
- **Compact & Dense:** Optimized for LLM token efficiency with a dedicated `## GRAPH EDGES` section.
- **Language-Agnostic:** Support for JS/TS, Python, Go, Rust, Java, C#, C/C++, Swift, PHP, Ruby, Dart, and more.

## Installation

### 1. Install via NPM
```bash
# Global installation for CLI use
npm install -g code-graph-llm

# Local project dependency
npm install --save-dev code-graph-llm
```

### 2. Basic Usage
```bash
# Generate the llm-code-graph.md map
code-graph generate

# Start the live watcher for real-time updates
code-graph watch

# Install the Git pre-commit hook
code-graph install-hook
```

## LLM Usage & Token Efficiency

### The "Read First" Strategy
Instruct your LLM agent to read `llm-code-graph.md` as its first step. The file provides a high-level map and a structural graph for relational reasoning:

**Example Map Entry:**
```markdown
- src/auth.js | desc: Handles user authentication.
  - syms: [login [ (username, password) ], validateToken [ (token: string) ]]

## GRAPH EDGES
[src/auth.js] -> [imports] -> [jwt-library]
[AdminUser] -> [inherits] -> [BaseUser]
```

**Example System Prompt:**
> "Before acting, read `llm-code-graph.md`. It contains the project map, file descriptions, and function signatures. Use this to locate relevant logic instead of scanning the full codebase."

## Build Phase Integration

### 1. Java/Kotlin (Maven/Gradle)
**Gradle (Groovy):**
```groovy
task generateCodeGraph(type: Exec) {
    commandLine 'code-graph', 'generate'
}
compileJava.dependsOn generateCodeGraph
```

### 2. Python
**Makefile:**
```makefile
map:
	code-graph generate
test: map
	pytest
```

### 3. Rust (build.rs)
```rust
use std::process::Command;
fn main() {
    Command::new("code-graph").arg("generate").status().unwrap();
}
```

## How it works
1. **File Scanning:** Recursively walks the directory, ignoring patterns in `.gitignore` (recursive).
2. **Context Extraction:** Scans for classes, functions, and variables while ignoring matches in comments.
3. **Graph Extraction:** Identifies `imports`, `requires`, `extends`, and `implements` to build a structural skeleton.
4. **Docstring Capture:** Captures preceding comments as descriptions.
5. **Signature Capture:** Fallback to declaration signatures (parameters) if docs are missing.
6. **Compilation:** Writes a single, minified `llm-code-graph.md` file with a dedicated `## GRAPH EDGES` section.
