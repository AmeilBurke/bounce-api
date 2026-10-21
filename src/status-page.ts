// Self-contained page served at GET /. It fetches /status every few seconds and redraws
export const STATUS_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bounce API</title>
<style>
  :root {
    --bg: #f6f6f8; --card: #ffffff; --text: #18181b; --muted: #71717a; --border: #e4e4e7;
    --ok: #059669; --bad: #e11d48; --accent: #7c3aed;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b0b0f; --card: #17171c; --text: #f4f4f5; --muted: #a1a1aa; --border: #27272a;
      --ok: #34d399; --bad: #fb7185; --accent: #a78bfa;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main { max-width: 760px; margin: 0 auto; padding: 48px 16px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
  h1 span { color: var(--accent); }
  .pill {
    display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--card); font-weight: 600; font-size: 14px;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); }
  .ok .dot { background: var(--ok); box-shadow: 0 0 0 4px color-mix(in srgb, var(--ok) 25%, transparent); animation: pulse 2s infinite; }
  .bad .dot { background: var(--bad); }
  @keyframes pulse { 50% { box-shadow: 0 0 0 7px transparent; } }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 36px 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
  .label { color: var(--muted); font-size: 13px; }
  .value { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 4px; }
  .value.small { font-size: 17px; }
  footer { margin-top: 36px; color: var(--muted); font-size: 13px; }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <header>
    <h1><span>Bounce</span> API</h1>
    <div id="pill" class="pill"><span class="dot"></span><span id="state">Checking…</span></div>
  </header>

  <h2>Server</h2>
  <div class="grid">
    <div class="card"><div class="label">Uptime</div><div class="value" id="uptime">–</div></div>
    <div class="card"><div class="label">Database</div><div class="value small" id="db">–</div></div>
    <div class="card"><div class="label">Started</div><div class="value small" id="started">–</div></div>
    <div class="card"><div class="label">Node</div><div class="value small" id="node">–</div></div>
  </div>

  <h2>Data</h2>
  <div class="grid" id="counts"></div>

  <footer>Refreshes every 5 seconds · Raw JSON at <a href="status">/status</a> · <span id="checked"></span></footer>
</main>
<script>
  const COUNT_LABELS = {
    venues: 'Venues', staff: 'Staff', bannedPeople: 'Banned people',
    activeBans: 'Active bans', pendingBans: 'Pending bans', alerts: 'Alerts',
  };
  const $ = (id) => document.getElementById(id);

  function formatUptime(total) {
    const d = Math.floor(total / 86400), h = Math.floor(total / 3600) % 24;
    const m = Math.floor(total / 60) % 60, s = total % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    return m + 'm ' + s + 's';
  }

  function setState(ok, text) {
    $('pill').className = 'pill ' + (ok ? 'ok' : 'bad');
    $('state').textContent = text;
  }

  async function refresh() {
    try {
      const res = await fetch('status', { cache: 'no-store' });
      const s = await res.json();
      setState(s.status === 'ok', s.status === 'ok' ? 'Running' : 'Database unreachable');
      $('uptime').textContent = formatUptime(s.uptimeSeconds);
      $('db').textContent = s.database.connected ? 'Connected · ' + s.database.latencyMs + ' ms' : 'Down';
      $('started').textContent = new Date(s.startedAt).toLocaleString();
      $('node').textContent = s.nodeVersion;
      $('counts').innerHTML = '';
      for (const [key, label] of Object.entries(COUNT_LABELS)) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = '<div class="label"></div><div class="value"></div>';
        card.children[0].textContent = label;
        card.children[1].textContent = s.counts ? s.counts[key] : '–';
        $('counts').appendChild(card);
      }
    } catch {
      setState(false, 'API unreachable');
    }
    $('checked').textContent = 'Last checked ' + new Date().toLocaleTimeString();
  }

  refresh();
  setInterval(refresh, 5000);
</script>
</body>
</html>`;
