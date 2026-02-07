/**
 * Agent Session Manager
 * Wraps the Claude Code SDK (@anthropic-ai/claude-code) for session management.
 * One active session per server instance.
 */

let activeQuery = null;
let abortController = null;
let pendingPermissionResolve = null;
let sessionId = null;

export function getSession() {
  return {
    activeQuery,
    resolvePermission(approved) {
      if (pendingPermissionResolve) {
        pendingPermissionResolve(approved);
        pendingPermissionResolve = null;
      }
    },
  };
}

export async function sendMessage(ws, message, taskId) {
  let claudeCode;
  try {
    claudeCode = await import('@anthropic-ai/claude-code');
  } catch (e) {
    ws.send(JSON.stringify({
      type: 'agent:error',
      error: 'Claude Code SDK not installed. Run: npm install @anthropic-ai/claude-code',
    }));
    return;
  }

  abortController = new AbortController();

  try {
    ws.send(JSON.stringify({ type: 'agent:status', status: 'thinking', taskId }));

    const model = process.env.CLAUDE_MODEL || undefined;

    activeQuery = claudeCode.query({
      prompt: message,
      options: {
        abortController,
        maxTurns: 30,
        model,
        cwd: process.cwd(),
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'default',
        resume: sessionId || undefined,
      },
    });

    for await (const event of activeQuery) {
      switch (event.type) {
        case 'system': {
          // Initial system message - capture session info
          if (event.session_id) sessionId = event.session_id;
          ws.send(JSON.stringify({
            type: 'agent:system',
            model: event.model,
            tools: event.tools,
            taskId,
          }));
          break;
        }

        case 'assistant': {
          // Assistant message with content blocks
          if (!event.message?.content) break;
          for (const block of event.message.content) {
            if (block.type === 'text') {
              ws.send(JSON.stringify({ type: 'agent:text', text: block.text, taskId }));
            } else if (block.type === 'tool_use') {
              ws.send(JSON.stringify({
                type: 'agent:tool_call',
                tool: block.name,
                input: block.input,
                toolUseId: block.id,
                taskId,
              }));
            }
          }
          break;
        }

        case 'user': {
          // Tool results come back as user messages
          if (event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'tool_result') {
                ws.send(JSON.stringify({
                  type: 'agent:tool_result',
                  toolUseId: block.tool_use_id,
                  content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
                  isError: block.is_error,
                  taskId,
                }));
              }
            }
          }
          break;
        }

        case 'result': {
          ws.send(JSON.stringify({
            type: 'agent:done',
            cost: event.total_cost_usd,
            duration: event.duration_ms,
            turns: event.num_turns,
            subtype: event.subtype,
            taskId,
          }));
          break;
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      ws.send(JSON.stringify({ type: 'agent:interrupted', taskId }));
    } else {
      ws.send(JSON.stringify({ type: 'agent:error', error: err.message, taskId }));
    }
  } finally {
    activeQuery = null;
    abortController = null;
  }
}

export async function interruptAgent(ws) {
  if (activeQuery) {
    try {
      await activeQuery.interrupt();
    } catch {
      // Fallback to abort controller
      abortController?.abort();
    }
    ws.send(JSON.stringify({ type: 'agent:interrupted' }));
  }
}
