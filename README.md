# CODE-GRAPH

A language-agnostic, ultra-compact codebase mapper designed specifically for LLM agents to optimize context and token usage. It doesn't just list files; it provides a high-signal "map" of your project's architecture, including descriptions and signatures.

## Features
- **Smart Context Extraction:** Captures JSDoc, Python docstrings, and preceding comments for files and symbols.
- **Signature Fallback:** Automatically extracts function signatures (parameters/types) if documentation is missing.
- **Recursive .gitignore Support:** Deeply respects both root and nested `.gitignore` files across the entire project structure.
- **Smart Flutter/Dart Support:** Optimized to reduce noise by filtering out common widget instantiations while capturing real functional declarations.
- **Compact & Dense:** Optimized for LLM token efficiency, replacing expensive recursive file scans.
- **Language-Agnostic:** Optimized regex support for JS/TS, Python, Go, Rust, Java, C#, C/C++, Swift, PHP, Ruby, Dart, and more.
- **Recursive Ignore Logic:** Deeply respects `.gitignore` and standard excludes (`node_modules`, `.git`).
- **Live Sync:** Continuous background updates or Git pre-commit hooks.

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
Instruct your LLM agent to read `llm-code-graph.md` as its first step. The file uses a dense format that provides immediate architectural context:

**Example Map Entry:**
```markdown
- src/auth.js | desc: Handles user authentication and JWT validation.
  - syms: [login [ (username, password) ], validateToken [ (token: string) ]]
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
1. **File Scanning:** Recursively walks the directory, ignoring patterns in `.gitignore`.
2. **Context Extraction:** Scans for classes, functions, and variables.
3. **Docstring Capture:** If a symbol has a preceding comment (`//`, `/**`, `#`, `"""`), it's captured as a description.
4. **Signature Capture:** If no comment is found, it captures the declaration signature (parameters) as a fallback.
5. **Compilation:** Writes a single, minified `llm-code-graph.md` file designed for machine consumption. 