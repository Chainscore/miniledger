// MiniLedger Dashboard — vanilla JS, no build step
const API = window.location.origin;
let refreshTimer = null;

// ── Fetch helpers ─────────────────────────────────────────────────

async function api(path) {
  try {
    const res = await fetch(API + path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function apiPost(path, body) {
  try {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return null;
  }
}

// ── Formatters ────────────────────────────────────────────────────

function shortHash(h) {
  if (!h) return '—';
  return h.substring(0, 8) + '...' + h.substring(h.length - 6);
}

function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 1000) return 'just now';
  if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  return Math.floor(diff / 3600000) + 'h ago';
}

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}

// ── Update functions ──────────────────────────────────────────────

async function updateStatus() {
  const data = await api('/status');
  if (!data) {
    document.getElementById('status-dot').className = 'dot red';
    document.getElementById('status-text').textContent = 'Disconnected';
    return;
  }

  document.getElementById('status-dot').className = 'dot green';
  document.getElementById('status-text').textContent = 'Running';
  document.getElementById('node-id').textContent = data.nodeId;
  document.getElementById('uptime').textContent = formatUptime(data.uptime);
  document.getElementById('stat-height').textContent = data.chainHeight;
  document.getElementById('stat-txpool').textContent = data.txPoolSize;
  document.getElementById('stat-peers').textContent = data.peerCount;
}

async function updateBlocks() {
  const data = await api('/blocks');
  if (!data) return;

  const el = document.getElementById('blocks-list');
  document.getElementById('block-count').textContent = data.height + 1;

  if (!data.blocks || data.blocks.length === 0) {
    el.innerHTML = '<div class="empty-state">No blocks yet</div>';
    return;
  }

  // Show newest first
  const blocks = [...data.blocks].reverse();
  el.innerHTML = blocks.map(b => `
    <div class="block-item">
      <span class="block-num">#${b.height}</span>
      <span class="block-hash">${shortHash(b.hash)}</span>
      <span class="block-meta">${b.transactions.length} tx · ${timeAgo(b.timestamp)}</span>
    </div>
  `).join('');
}

async function updateTransactions() {
  // Get transactions from recent blocks
  const data = await api('/blocks');
  if (!data || !data.blocks) return;

  const el = document.getElementById('tx-list');
  const allTx = [];

  for (const block of data.blocks) {
    for (const tx of block.transactions) {
      allTx.push({ ...tx, blockHeight: block.height });
    }
  }

  allTx.sort((a, b) => b.timestamp - a.timestamp);
  const recent = allTx.slice(0, 20);

  document.getElementById('tx-count').textContent = allTx.length;

  if (recent.length === 0) {
    el.innerHTML = '<div class="empty-state">No transactions yet</div>';
    return;
  }

  el.innerHTML = recent.map(tx => `
    <div class="tx-item">
      <span class="tx-hash">${shortHash(tx.hash)}</span>
      <span class="tx-type">${tx.type}</span>
      <div style="font-size:12px;color:var(--text-dim);margin-top:2px">
        Block #${tx.blockHeight} · ${timeAgo(tx.timestamp)}
      </div>
    </div>
  `).join('');
}

async function updatePeers() {
  const data = await api('/peers');
  if (!data) return;

  const el = document.getElementById('peers-list');
  document.getElementById('peer-badge').textContent = data.count;

  if (!data.peers || data.peers.length === 0) {
    el.innerHTML = '<div class="empty-state">No peers connected (solo mode)</div>';
    return;
  }

  el.innerHTML = data.peers.map(p => `
    <div class="peer-item">
      <span class="dot ${p.status === 'connected' ? 'green' : 'red'}"></span>
      <span class="peer-id">${p.nodeId}</span>
      <span style="color:var(--text-dim);font-size:12px">${p.address || '—'}</span>
      <span style="margin-left:auto;font-size:12px;color:var(--text-dim)">H:${p.chainHeight}</span>
    </div>
  `).join('');
}

async function updateContractsGov() {
  const [contracts, proposals] = await Promise.all([
    api('/contracts'),
    api('/proposals'),
  ]);

  const el = document.getElementById('contracts-gov');
  let html = '';

  if (contracts && contracts.contracts && contracts.contracts.length > 0) {
    html += '<div style="margin-bottom:12px;font-size:12px;color:var(--text-dim);font-weight:600">CONTRACTS</div>';
    html += contracts.contracts.map(c => `
      <div class="tx-item">
        <strong>${c.name}</strong> <span class="tx-type">v${c.version}</span>
        <div style="font-size:12px;color:var(--text-dim);margin-top:2px">by ${shortHash(c.deployedBy)}</div>
      </div>
    `).join('');
  }

  if (proposals && proposals.proposals && proposals.proposals.length > 0) {
    html += '<div style="margin-top:12px;margin-bottom:12px;font-size:12px;color:var(--text-dim);font-weight:600">PROPOSALS</div>';
    html += proposals.proposals.map(p => `
      <div class="tx-item">
        <strong>${p.title}</strong>
        <span class="tx-type">${p.status}</span>
        <div style="font-size:12px;color:var(--text-dim);margin-top:2px">
          ${Object.keys(p.votes).length} votes · by ${shortHash(p.proposer)}
        </div>
      </div>
    `).join('');
  }

  if (!html) {
    html = '<div class="empty-state">No contracts or proposals</div>';
  }

  el.innerHTML = html;
}

async function updateStateCount() {
  const data = await apiPost('/state/query', {
    sql: 'SELECT COUNT(*) as count FROM world_state WHERE key NOT LIKE \'_%\'',
  });
  if (data && data.results && data.results.length > 0) {
    document.getElementById('stat-state').textContent = data.results[0].count || 0;
  }
}

// ── SQL Query ─────────────────────────────────────────────────────

async function runQuery() {
  const sql = document.getElementById('sql-input').value.trim();
  if (!sql) return;

  const el = document.getElementById('query-results');
  el.innerHTML = '<div class="empty-state">Running...</div>';

  const data = await apiPost('/state/query', { sql });
  if (!data) {
    el.innerHTML = '<div class="empty-state" style="color:var(--red)">Query failed</div>';
    return;
  }

  if (data.error) {
    el.innerHTML = `<div class="empty-state" style="color:var(--red)">${data.error}</div>`;
    return;
  }

  if (!data.results || data.results.length === 0) {
    el.innerHTML = '<div class="empty-state">No results</div>';
    return;
  }

  const cols = Object.keys(data.results[0]);
  const headerRow = cols.map(c => `<th>${c}</th>`).join('');
  const rows = data.results.map(r =>
    '<tr>' + cols.map(c => `<td title="${String(r[c] ?? '')}">${String(r[c] ?? '')}</td>`).join('') + '</tr>'
  ).join('');

  el.innerHTML = `
    <table class="result-table">
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// Enter key runs query
document.getElementById('sql-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runQuery();
});

// ── Refresh loop ──────────────────────────────────────────────────

async function refreshAll() {
  await Promise.all([
    updateStatus(),
    updateBlocks(),
    updateTransactions(),
    updatePeers(),
    updateContractsGov(),
    updateStateCount(),
  ]);
}

// Initial load
refreshAll();

// Auto-refresh every 2 seconds
refreshTimer = setInterval(refreshAll, 2000);
