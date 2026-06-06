const express = require('express');
const fs = require('fs');
const path = require('path');
const geoip = require('geoip-lite');
const requestIp = require('request-ip');

const app = express();
const PORT = process.env.PORT || 8089;

const redirects = JSON.parse(fs.readFileSync(path.join(__dirname, 'redirects.json'), 'utf-8'));
const VISITS_FILE = path.join(__dirname, 'visits.json');

app.set('trust proxy', true);
app.use(requestIp.mw());

app.get('/favicon.ico', (_req, res) => res.status(204).end());

app.get('/visits', (_req, res) => {
  if (!fs.existsSync(VISITS_FILE)) {
    return res.send('<h2>No visits yet</h2>');
  }

  const lines = fs.readFileSync(VISITS_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  const visits = lines.map(l => JSON.parse(l));

  let rows = visits.map((v, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${v.key}</td>
      <td><a href="${v.target}">${v.target}</a></td>
      <td>${v.ip}</td>
      <td>${v.country || '-'}</td>
      <td>${v.city || '-'}</td>
      <td>${v.region || '-'}</td>
      <td>${new Date(v.timestamp).toLocaleString()}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(v.userAgent || '').replace(/"/g, '&quot;')}">${v.userAgent ? v.userAgent.substring(0, 60) + '…' : '-'}</td>
      <td title="${(v.referer || '').replace(/"/g, '&quot;')}">${v.referer ? v.referer.substring(0, 40) + '…' : '-'}</td>
    </tr>`).join('\n');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Visits</title>
<style>
body{font-family:system-ui,sans-serif;margin:20px;background:#f5f5f5}
h2{margin-bottom:10px}
table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #ddd;font-size:13px}
th{background:#333;color:#fff;position:sticky;top:0}
tr:hover{background:#f0f0f0}
.wrap{overflow-x:auto}
.count{color:#666;margin-bottom:10px}
a{color:#06c}
</style>
</head>
<body>
<h2>Visit Logs</h2>
<div class="count">${visits.length} visit(s)</div>
<div class="wrap"><table>
<thead><tr>
<th>#</th><th>Key</th><th>Target</th><th>IP</th><th>Country</th><th>City</th><th>Region</th><th>Timestamp</th><th>User Agent</th><th>Referer</th>
</tr></thead>
<tbody>${rows}</tbody>
</table></div>
</body>
</html>`);
});

app.get('/:key', (req, res) => {
  const { key } = req.params;
  const target = redirects[key];

  if (!target) {
    return res.status(404).send('Not found');
  }

  const ip = req.clientIp || req.ip;
  const geo = geoip.lookup(ip);

  const visit = {
    key,
    target,
    ip,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || null,
    referer: req.headers['referer'] || null,
    country: geo?.country || null,
    city: geo?.city || null,
    region: geo?.region || null,
    ll: geo?.ll || null,
  };

  fs.appendFile(VISITS_FILE, JSON.stringify(visit) + '\n', (err) => {
    if (err) console.error('Failed to log visit:', err.message);
  });

  res.redirect(302, target);
});

app.listen(PORT, () => {
  console.log(`Redirector running on http://0.0.0.0:${PORT}`);
});
