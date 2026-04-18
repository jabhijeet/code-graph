/**
 * @file lib/mcp.js
 * @description Minimal stdio MCP server for code-graph.
 */

import { CONFIG } from './config.js';
import { ProjectInitializer } from './initializer.js';
import { ProjectMapper } from './mapper.js';

export function startMCPServer(defaultCwd = process.cwd()) {
  console.log = (...args) => console.error(...args);
  console.warn = (...args) => console.error(...args);

  let buffer = Buffer.alloc(0);

  process.stdin.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const parsed = readMessage(buffer);
      if (!parsed) break;
      buffer = parsed.rest;
      handleMessage(parsed.message, defaultCwd).catch(err => {
        if (parsed.message?.id !== undefined) {
          send({
            jsonrpc: '2.0',
            id: parsed.message.id,
            error: { code: -32603, message: err.message }
          });
        }
      });
    }
  });
}

function readMessage(buffer) {
  const headerEnd = buffer.indexOf('\r\n\r\n');
  if (headerEnd === -1) return null;

  const headers = buffer.subarray(0, headerEnd).toString('utf8');
  const lengthMatch = headers.match(/Content-Length:\s*(\d+)/i);
  if (!lengthMatch) throw new Error('Missing Content-Length header');

  const length = Number(lengthMatch[1]);
  const bodyStart = headerEnd + 4;
  const bodyEnd = bodyStart + length;
  if (buffer.length < bodyEnd) return null;

  const body = buffer.subarray(bodyStart, bodyEnd).toString('utf8');
  return {
    message: JSON.parse(body),
    rest: buffer.subarray(bodyEnd)
  };
}

async function handleMessage(message, defaultCwd) {
  if (message.id === undefined) return;

  switch (message.method) {
    case 'initialize':
      return send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'code-graph', version: CONFIG.VERSION }
        }
      });
    case 'tools/list':
      return send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: [{
            name: 'code_graph_generate',
            description: 'Generate llm-code-graph.md for a project directory.',
            inputSchema: {
              type: 'object',
              properties: {
                cwd: {
                  type: 'string',
                  description: 'Project directory. Defaults to the directory configured during install.'
                }
              },
              additionalProperties: false
            }
          }]
        }
      });
    case 'tools/call':
      return callTool(message, defaultCwd);
    default:
      return send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32601, message: `Unknown method: ${message.method}` }
      });
  }
}

async function callTool(message, defaultCwd) {
  const name = message.params?.name;
  if (name !== 'code_graph_generate') {
    return send({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32602, message: `Unknown tool: ${name}` }
    });
  }

  const cwd = message.params?.arguments?.cwd || defaultCwd;
  await ProjectInitializer.init(cwd);
  await new ProjectMapper(cwd).generate();

  send({
    jsonrpc: '2.0',
    id: message.id,
    result: {
      content: [{
        type: 'text',
        text: `Updated llm-code-graph.md in ${cwd}`
      }]
    }
  });
}

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}
