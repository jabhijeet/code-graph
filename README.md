# CODE-GRAPH

A language-agnostic, ultra-compact codebase mapper designed specifically for LLM agents to optimize context and token usage.

## Installation

### 1. Install via NPM (Recommended)
You can install **Code-Graph** globally or as a project-specific dependency without cloning the repository.

**Global Installation:**
```bash
npm install -g code-graph-llm
```

**Local Project Dependency:**
```bash
npm install --save-dev code-graph-llm
```

### 2. Direct Usage
Once installed, you can run it from any project directory:
```bash
# Generate the map
code-graph generate

# Start the live watcher
code-graph watch
```

## Usage in Different Workflows

### 1. Node.js (package.json)
If installed as a dependency, add it to your scripts:
```json
"scripts": {
  "postinstall": "code-graph generate",
  "pretest": "code-graph generate"
}
```

### 2. Git Integration
Automatically update and stage `llm-code-graph.md` on every commit:
```bash
code-graph install-hook
```

---

## LLM Usage & Token Efficiency

To achieve the best performance and minimize token consumption, follow these guidelines:

### 1. The "Read First" Rule
Always instruct the LLM agent to read `llm-code-graph.md` as its first step. It provides an immediate, high-level map without scanning every directory.

**Example System Prompt:**
> "Before performing any tasks, read `llm-code-graph.md` to understand the project structure. Use this map to target specific files rather than scanning the entire codebase."

### 2. Targeted File Reads
The `|syms:[...]` metadata allows the LLM to identify exactly which file contains a specific function or class. It can jump directly to the relevant file.

---

## Language Examples & Build Phase Integration

### 1. Rust (build.rs)
```rust
use std::process::Command;
fn main() {
    Command::new("code-graph").arg("generate").status().unwrap();
}
```

### 2. Java/Kotlin (Maven/Gradle)

#### Maven (pom.xml)
```xml
<plugin>
  <groupId>org.codehaus.mojo</groupId>
  <artifactId>exec-maven-plugin</artifactId>
  <executions>
    <execution>
      <phase>compile</phase>
      <goals><goal>exec</goal></goals>
      <configuration>
        <executable>code-graph</executable>
        <arguments><argument>generate</argument></arguments>
      </configuration>
    </execution>
  </executions>
</plugin>
```

#### Gradle (Groovy DSL)
```groovy
task generateCodeGraph(type: Exec) {
    commandLine 'code-graph', 'generate'
}
compileJava.dependsOn generateCodeGraph
```

### 3. Python Integration
Add this to your `Makefile`:
```makefile
map:
	code-graph generate
```

---

## How it works
The tool scans your project directory (respecting `.gitignore`), extracts classes, functions, and exports using optimized regular expressions, and compiles them into a dense, machine-readable `llm-code-graph.md` file.

## Publishing as a Package (For Developers)
To publish this to the NPM registry:
1. Log in: `npm login`
2. Publish: `npm publish --access public` (Ensure the name in `package.json` is unique, e.g., `code-graph-llm`).
