#!/usr/bin/env node
/**
 * PreToolUse Bash protect hook — Claude Code workflow v3
 *
 * Reads tool input from stdin (JSON), inspects the bash command,
 * blocks dangerous patterns with exit 2 (which returns stderr to Claude).
 *
 * Patterns blocked:
 *   - git push --force / -f
 *   - rm -rf outside /tmp, /home/claude, scratch dirs
 *   - .env file writes (rm, redirect, echo)
 *
 * All other commands pass through (exit 0).
 */

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let cmd = '';
  try {
    const parsed = JSON.parse(input);
    cmd = (parsed.tool_input && parsed.tool_input.command) || '';
  } catch {
    process.exit(0); // Can't parse — let it through
  }

  if (!cmd) process.exit(0);

  // Block force push — match only at line start to avoid false positives in commit messages
  if (/(?:^|\n)\s*git\s+push.*(--force|--force-with-lease|-f\b)/m.test(cmd)) {
    process.stderr.write('BLOCKED: force push not allowed via Claude Code. Use manual git.\n');
    process.exit(2);
  }

  // Block rm -rf outside known-safe dirs
  if (/^\s*rm\s+-r?f\s/.test(cmd)) {
    const isSafe = /(\/tmp\/|\/home\/claude\/|node_modules|dist\/|coverage\/|lighthouse-)/.test(cmd);
    if (!isSafe) {
      process.stderr.write('BLOCKED: rm -rf outside /tmp, /home/claude, or build artifact dirs requires manual run.\n');
      process.exit(2);
    }
  }

  // Block .env writes — match only when .env is the direct target of a write/delete op
  const isWriteOp = /(>\s*\.env\b|rm\s+\S*\.env\b|echo\s[^>]*>\s*\.env\b|cat\s[^>]*>\s*\.env\b|sed\s+-i\s+\S*\.env\b)/.test(cmd);
  if (isWriteOp) {
    process.stderr.write('BLOCKED: .env modification via Bash not allowed. Use manual edit.\n');
    process.exit(2);
  }

  process.exit(0);
});

// Safety: if stdin never closes, exit 0 after 5 seconds
setTimeout(() => process.exit(0), 5000);
