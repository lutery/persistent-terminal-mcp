// Terminal Detail Page Logic

let term = null;
let ws = null;
let terminalId = null;
let currentCursor = 0;
let currentOutputMode = 'full';
let currentAdapter = 'generic';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Get terminal ID from URL
  const pathParts = window.location.pathname.split('/');
  terminalId = pathParts[pathParts.length - 1];

  if (!terminalId) {
    alert('Invalid terminal ID');
    window.location.href = '/';
    return;
  }

  setupTerminal();
  setupEventListeners();
  connectWebSocket();
  loadTerminalInfo();
  loadTerminalOutput();
  loadTerminalStatus();
});

// Setup xterm.js
function setupTerminal() {
  try {
    term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: '#ffffff40'
      },
      convertEol: true,
      rows: 24,
      cols: 80
    });

    const container = document.getElementById('terminal-container');
    term.open(container);

    // Fit terminal to container
    if (typeof FitAddon !== 'undefined') {
      try {
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        fitAddon.fit();

        // Resize on window resize
        window.addEventListener('resize', () => {
          fitAddon.fit();
        });
      } catch (e) {
        console.warn('FitAddon not available:', e);
      }
    }

    console.log('Terminal initialized successfully');
  } catch (error) {
    console.error('Failed to setup terminal:', error);
    alert('Failed to initialize terminal: ' + error.message);
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('send-btn').addEventListener('click', sendCommand);
  document.getElementById('command-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendCommand();
    }
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    term.clear();
  });

  document.getElementById('kill-btn').addEventListener('click', killTerminal);

  // Status panel
  document.getElementById('refresh-status-btn').addEventListener('click', loadTerminalStatus);

  // Output filter
  document.getElementById('output-mode').addEventListener('change', (e) => {
    const mode = e.target.value;
    const adapterLabel = document.getElementById('adapter-label');
    const adapterSelect = document.getElementById('output-adapter');
    if (mode === 'last_response') {
      adapterLabel.style.display = '';
      adapterSelect.style.display = '';
    } else {
      adapterLabel.style.display = 'none';
      adapterSelect.style.display = 'none';
    }
  });

  document.getElementById('apply-filter-btn').addEventListener('click', applyOutputFilter);

  // Wait for pattern
  document.getElementById('wait-pattern-btn').addEventListener('click', waitForPattern);

  // Wait for result
  document.getElementById('wait-result-btn').addEventListener('click', waitForResult);

  // Resume
  document.getElementById('resume-btn').addEventListener('click', resumeTerminal);
}

// WebSocket connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected, reconnecting...');
    setTimeout(connectWebSocket, 2000);
  };
}

// Handle WebSocket messages
function handleWebSocketMessage(message) {
  if (message.terminalId !== terminalId) return;

  switch (message.type) {
    case 'output':
      term.write(message.data);
      break;
    case 'exit':
      updateStatus('terminated');
      term.write('\r\n[Terminal Exited]\r\n');
      break;
    case 'status_changed':
      loadTerminalStatus();
      break;
  }
}

// Load terminal info
async function loadTerminalInfo() {
  try {
    const response = await fetch(`/api/terminals/${terminalId}`);

    if (!response.ok) {
      throw new Error(`Terminal not found (${response.status})`);
    }

    const data = await response.json();

    document.getElementById('terminal-title').textContent = `Terminal ${data.id.substring(0, 8)}`;
    document.getElementById('detail-pid').textContent = data.pid;
    document.getElementById('detail-shell').textContent = data.shell;
    document.getElementById('detail-cwd').textContent = data.cwd;
    document.getElementById('detail-created').textContent = new Date(data.created).toLocaleString();

    updateStatus(data.status);
  } catch (error) {
    console.error('Failed to load terminal info:', error);
    alert('Failed to load terminal: ' + error.message);
  }
}

// Load terminal output
async function loadTerminalOutput() {
  try {
    const response = await fetch(`/api/terminals/${terminalId}/output?since=${currentCursor}&raw=true`);

    if (!response.ok) {
      throw new Error('Failed to load output');
    }

    const data = await response.json();

    if (data.output) {
      term.write(data.output);
    }

    currentCursor = data.cursor || data.since || 0;
  } catch (error) {
    console.error('Failed to load terminal output:', error);
  }
}

// Load terminal status
async function loadTerminalStatus() {
  try {
    const response = await fetch(`/api/terminals/${terminalId}/status`);

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    document.getElementById('status-process').textContent = data.processStatus || '-';
    document.getElementById('status-semantic').textContent = (data.semanticStatus || '-').replace('_', ' ');
    document.getElementById('status-last-activity').textContent = data.lastActivity ? formatRelativeTime(data.lastActivity) : '-';
    document.getElementById('status-pending').textContent = data.pendingCommand ? data.pendingCommand.command : 'none';
    document.getElementById('status-prompt').textContent = data.promptVisible ? 'Yes' : 'No';

    // Update the process status with a badge style
    const processEl = document.getElementById('status-process');
    processEl.className = 'status-value status-badge semantic-' + (data.processStatus || 'unknown');

    const semanticEl = document.getElementById('status-semantic');
    const semanticClass = 'semantic-' + (data.semanticStatus || 'unknown').replace('_', '-');
    semanticEl.className = 'status-value status-badge ' + semanticClass;
  } catch (error) {
    console.error('Failed to load terminal status:', error);
  }
}

// Apply output filter
async function applyOutputFilter() {
  const mode = document.getElementById('output-mode').value;
  const adapter = document.getElementById('output-adapter').value;
  const outputEl = document.getElementById('filtered-output');

  try {
    const params = new URLSearchParams({
      since: currentCursor.toString(),
      mode: mode
    });

    if (mode === 'content_only' || mode === 'last_response') {
      params.set('adapter', adapter);
    }

    const response = await fetch(`/api/terminals/${terminalId}/output?${params}`);

    if (!response.ok) {
      throw new Error('Failed to apply filter');
    }

    const data = await response.json();

    if (data.output) {
      outputEl.textContent = data.output;
      outputEl.style.display = 'block';
    } else {
      outputEl.textContent = '(no output)';
      outputEl.style.display = 'block';
    }
  } catch (error) {
    outputEl.textContent = 'Error: ' + error.message;
    outputEl.style.display = 'block';
  }
}

// Wait for pattern
async function waitForPattern() {
  const pattern = document.getElementById('wait-pattern-input').value.trim();
  const timeoutMs = parseInt(document.getElementById('wait-pattern-timeout').value, 10) || 30000;
  const resultEl = document.getElementById('wait-pattern-result');
  const btn = document.getElementById('wait-pattern-btn');

  if (!pattern) {
    resultEl.textContent = 'Please enter a pattern.';
    resultEl.className = 'wait-result wait-error';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Waiting...';
  resultEl.textContent = 'Waiting for pattern...';
  resultEl.className = 'wait-result wait-pending';

  try {
    const response = await fetch(`/api/terminals/${terminalId}/wait-pattern`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, timeoutMs })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to wait for pattern');
    }

    const data = await response.json();

    if (data.matched) {
      const matchText = data.match ? data.match.text : '';
      resultEl.textContent = `Matched in ${data.elapsedMs}ms${matchText ? ': ' + matchText : ''}`;
      resultEl.className = 'wait-result wait-success';
    } else if (data.timedOut) {
      resultEl.textContent = `Timed out after ${data.elapsedMs}ms`;
      resultEl.className = 'wait-result wait-timeout';
    } else {
      resultEl.textContent = `No match (process may have exited)`;
      resultEl.className = 'wait-result wait-timeout';
    }
  } catch (error) {
    resultEl.textContent = 'Error: ' + error.message;
    resultEl.className = 'wait-result wait-error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Wait';
  }
}

// Wait for result (XML)
async function waitForResult() {
  const timeoutMs = parseInt(document.getElementById('wait-result-timeout').value, 10) || 60000;
  const resultEl = document.getElementById('wait-result-result');
  const btn = document.getElementById('wait-result-btn');

  btn.disabled = true;
  btn.textContent = 'Waiting...';
  resultEl.textContent = 'Waiting for XML result...';
  resultEl.className = 'wait-result wait-pending';

  try {
    const response = await fetch(`/api/terminals/${terminalId}/wait-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeoutMs })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to wait for result');
    }

    const data = await response.json();

    if (data.wait && data.wait.matched) {
      if (data.parsed && data.parsed.parsed) {
        const parsed = data.parsed.parsed;
        resultEl.textContent = `Result: ${parsed.status}${parsed.summary ? ' - ' + parsed.summary : ''} (${data.wait.elapsedMs}ms)`;
        resultEl.className = 'wait-result wait-' + (parsed.status === 'PASS' ? 'success' : parsed.status === 'FAIL' ? 'error' : 'timeout');
      } else {
        const matchText = data.wait.match ? data.wait.match.text : '';
        resultEl.textContent = `Matched in ${data.wait.elapsedMs}ms but parse failed${data.parsed && data.parsed.errors && data.parsed.errors.length ? ': ' + data.parsed.errors[0].message : ''}`;
        resultEl.className = 'wait-result wait-error';
      }
    } else if (data.wait && data.wait.timedOut) {
      resultEl.textContent = `Timed out after ${data.wait.elapsedMs}ms`;
      resultEl.className = 'wait-result wait-timeout';
    } else {
      resultEl.textContent = `No result found (process may have exited)`;
      resultEl.className = 'wait-result wait-timeout';
    }
  } catch (error) {
    resultEl.textContent = 'Error: ' + error.message;
    resultEl.className = 'wait-result wait-error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Wait';
  }
}

// Resume terminal
async function resumeTerminal() {
  const sessionId = document.getElementById('resume-session-id').value.trim();
  const resultEl = document.getElementById('resume-result');
  const btn = document.getElementById('resume-btn');

  if (!sessionId) {
    resultEl.textContent = 'Please enter a session ID.';
    resultEl.className = 'wait-result wait-error';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Resuming...';
  resultEl.textContent = 'Resuming session...';
  resultEl.className = 'wait-result wait-pending';

  try {
    const response = await fetch(`/api/terminals/${terminalId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to resume terminal');
    }

    const data = await response.json();

    if (data.init) {
      const initStatus = data.init.status;
      if (initStatus === 'ready') {
        resultEl.textContent = `Resumed successfully (ready in ${data.init.elapsedMs}ms). New terminal: ${data.terminalId.substring(0, 8)}...`;
        resultEl.className = 'wait-result wait-success';
        // Optionally navigate to the new terminal
        if (confirm('Session resumed in new terminal. Open it?')) {
          window.location.href = `/terminal/${data.terminalId}`;
        }
      } else if (initStatus === 'timeout') {
        resultEl.textContent = `Resumed but init timed out (${data.init.elapsedMs}ms). New terminal: ${data.terminalId.substring(0, 8)}...`;
        resultEl.className = 'wait-result wait-timeout';
      } else {
        resultEl.textContent = `Resumed with status: ${initStatus} (${data.init.elapsedMs}ms). New terminal: ${data.terminalId.substring(0, 8)}...`;
        resultEl.className = 'wait-result wait-timeout';
      }
    } else {
      resultEl.textContent = 'Resume completed but no init info returned.';
      resultEl.className = 'wait-result wait-timeout';
    }
  } catch (error) {
    resultEl.textContent = 'Error: ' + error.message;
    resultEl.className = 'wait-result wait-error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Resume';
  }
}

// Send command
async function sendCommand() {
  const input = document.getElementById('command-input');
  const command = input.value;

  if (!command.trim()) return;

  try {
    const response = await fetch(`/api/terminals/${terminalId}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: command })
    });

    if (!response.ok) {
      throw new Error('Failed to send command');
    }

    input.value = '';
  } catch (error) {
    console.error('Failed to send command:', error);
    alert('Failed to send command: ' + error.message);
  }
}

// Kill terminal
async function killTerminal() {
  if (!confirm('Are you sure you want to kill this terminal?')) {
    return;
  }

  try {
    const response = await fetch(`/api/terminals/${terminalId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to kill terminal');
    }

    alert('Terminal killed');
    window.location.href = '/';
  } catch (error) {
    console.error('Failed to kill terminal:', error);
    alert('Failed to kill terminal: ' + error.message);
  }
}

// Update status badge
function updateStatus(status) {
  const badge = document.getElementById('terminal-status');
  badge.textContent = status;
  badge.className = 'status-badge status-' + status;
}

// Format relative time
function formatRelativeTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}
