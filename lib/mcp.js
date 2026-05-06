/**
 * @file lib/mcp.js
 * @description Minimal stdio MCP server for code-graph.
 */

import { CONFIG } from './config.js';
import { ProjectInitializer } from './initializer.js';
import { ProjectMapper } from './mapper.js';

// Logger that writes to stderr to avoid corrupting the MCP stdio protocol on stdout
const logger = {
  info: (...args) => console.error('[MCP]', ...args),
  warn: (...args) => console.error('[MCP]', ...args),
  error: (...args) => console.error('[MCP]', ...args),
};

export function startMCPServer(defaultCwd = process.cwd()) {
  logger.info(`Starting MCP server (default cwd: ${defaultCwd})`);
  let buffer = Buffer.alloc(0);

  process.stdin.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      let parsed;
      try {
        parsed = readMessage(buffer);
      } catch (err) {
        logger.error(`Protocol error: ${err.message}`);
        buffer = Buffer.alloc(0);
        break;
      }
      if (!parsed) break;
      buffer = parsed.rest;
      handleMessage(parsed.message, defaultCwd).catch(err => {
        logger.error(`Error handling message: ${err.message}`);
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
  if (!lengthMatch) {
    logger.error('Missing Content-Length header');
    throw new Error('Missing Content-Length header');
  }

  const length = Number(lengthMatch[1]);
  const bodyStart = headerEnd + 4;
  const bodyEnd = bodyStart + length;
  if (buffer.length < bodyEnd) return null;

  const body = buffer.subarray(bodyStart, bodyEnd).toString('utf8');
  try {
    return {
      message: JSON.parse(body),
      rest: buffer.subarray(bodyEnd)
    };
  } catch (e) {
    logger.error(`Failed to parse JSON: ${e.message}`);
    throw e;
  }
}

async function handleMessage(message, defaultCwd) {
  if (message.id === undefined) {
    logger.warn('Received message without id, ignoring');
    return;
  }

  logger.info(`Handling method: ${message.method}`);
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
      logger.warn(`Unknown method: ${message.method}`);
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
    logger.warn(`Unknown tool: ${name}`);
    return send({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32602, message: `Unknown tool: ${name}` }
    });
  }

  const cwd = message.params?.arguments?.cwd || defaultCwd;
  logger.info(`Generating code graph for: ${cwd}`);
  try {
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
  } catch (err) {
    logger.error(`Failed to generate code graph: ${err.message}`);
    throw err;
  }
}

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}
