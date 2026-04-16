# CODE_GRAPH
MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
PROTOCOL: Follow llm-agent-rules.md
MEMORY: See llm-agent-project-learnings.md

> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- *index.js (7↑ 1↓) [TODO: |FIXME|BUG|DEPRECATED):?\s*(.*)/i,,bug: s or complex regex pitfalls.,bug: s or version deprecations.,bug: fix or failure.\n`;,bug: ,"] | d: !usrbinenv node
  - s: [AgentManager [Manages sub-agent registrations and orchestrator integrations.], CONFIG [=], CodeParser [--- Core Services --- Handles extraction of symbols, edges, and metadata from source code.], ProjectInitializer [Scaffolds the initial agent-agnostic rule and reflection files.], ProjectMapper [Manages the project mapping and file generation.], ReflectionManager [Manages project reflections and lessons learned.], SUPPORTED_EXTENSIONS [: [], SkillManager [Manages platform-specific skills and agent integrations.], add [(context ? `${display} [${context}]` : display)], appendToFile [('CLAUDE.md', section)], execute [(platform, action, skill)], extract [(content)], init [(cwd)], install [-skills <platform> [projectmap|reflections]')], installAntigravityAgent [()], installGeminiAgent [()], installGenericPersona [()], installGitHook [(cwd)], installGlobalSkill [('gemini', 'projectmap', geminiSkill)], installKiroAgent [()], installMCPServer [()], installProjectMap [(p)], installReflections [(p)], main [|app|server|cli)\./i.test(path.basename(relPath))], processFile [(fullPath, relPath)], removeFile [('.cursor/rules/projectmap.mdc')], uninstall [-skills') await this.uninstall(p, s)], walk [(dir, ig)], writeFile [(path.join(this.cwd, CONFIG.MAP_FILE)], writeJson [('.claude/settings.json', { hooks: { preToolUse: [{ tools: ['glob', 'grep'], message: `Skill(ProjectMap)]]
- *test/index.test.js (10↑ 0↓) | d: 
  - s: []

## EDGES
[index.js] -> [chokidar, fs, ignore, os, path, symbols, url]
[test/index.test.js] -> [index.js, test/local-file, assert, fs, header.h, node, other-module, path, test, url]