# GEMINI-HELPER

A language-agnostic, ultra-compact codebase mapper designed specifically for LLM agents.

## Features
- **Compact:** Minimizes tokens by extracting only structural symbols.
- **Language-Agnostic:** Uses regex heuristics for universal compatibility.
- **Live:** Supports three update modes: on-demand, background watch, and git hooks.

## Usage

### 1. On-Demand Generation
Regenerate `GEMINI.md` immediately:
```bash
node index.js generate
```

### 2. Live Watching
Keep `GEMINI.md` updated in real-time while you code:
```bash
node index.js watch
```

### 3. Git Integration
Automatically update and stage `GEMINI.md` on every commit:
```bash
node index.js install-hook
```

## LLM Usage & Token Efficiency

To achieve the best performance and minimize token consumption, follow these guidelines when using this project with an LLM agent:

### 1. The "Read First" Rule
Always instruct the LLM agent to read `GEMINI.md` as its first step in any session. This provides an immediate, high-level map of the codebase without the overhead of scanning every directory.

**Example System Prompt / Instruction:**
> "Before performing any tasks, read `GEMINI.md` to understand the project structure and locate relevant symbols. Use this map to target specific files for reading rather than scanning the entire codebase."

### 2. Targeted File Reads
The `|syms:[...]` metadata allows the LLM to identify exactly which file contains a specific function or class. Instead of the LLM saying "I'll search for the definition of X," it can see `index.js|syms:[...,X,...]` and read only that file.

### 3. Avoiding Context Bloat
By using `GEMINI.md`, you can prevent the LLM from "hallucinating" the project structure or wasting tokens on `ls -R` commands. A single read of this compact file replaces dozens of file-listing and grep operations.

### 4. Continuous Context
Because `GEMINI.md` is updated live (via `watch` or `pre-commit`), the LLM always has a "source of truth" for the current state of the project's architecture, even during heavy refactoring.

## Language Examples
... (rest of the file)

The regex-based extractor identifies structural symbols across many languages:

| Language | Recognized Patterns |
|----------|---------------------|
| **Java/Kotlin** | `class MyClass`, `interface I`, `fun myFunc` |
| **Python** | `def my_func():`, `class MyClass:` |
| **Go** | `func MyFunc()`, `type MyStruct struct` |
| **JS/TS** | `function f()`, `export const x = () =>`, `interface I` |
| **Rust** | `fn my_func()`, `struct MyStruct`, `trait MyTrait` |
| **Dart** | `class MyClass`, `void myFunc()` |

## Build Phase Integration

Integrate `gemini-helper` into your existing build pipelines to ensure `GEMINI.md` is always fresh.

### 1. Node.js (package.json)
```json
"scripts": {
  "prepare": "node index.js generate"
}
```

### 2. Rust (Cargo.toml / build.rs)
Add to your `build.rs`:
```rust
use std::process::Command;
fn main() {
    Command::new("node").args(&["index.js", "generate"]).status().unwrap();
}
```

### 3. Java (Maven pom.xml)
```xml
<plugin>
  <groupId>org.codehaus.mojo</groupId>
  <artifactId>exec-maven-plugin</artifactId>
  <executions>
    <execution>
      <phase>compile</phase>
      <goals><goal>exec</goal></goals>
      <configuration>
        <executable>node</executable>
        <arguments><argument>index.js</argument><argument>generate</argument></arguments>
      </configuration>
    </execution>
  </executions>
</plugin>
```

### 4. Python (Poetry/Setuptools)
Add a pre-build script or use a Task runner like `invoke` or `make`.

## How it works
The tool scans your project directory (respecting `.gitignore`), extracts classes, functions, and exports using optimized regular expressions, and compiles them into a dense, machine-readable `GEMINI.md` file. LLM agents should read this file first to gain instant architectural context.
