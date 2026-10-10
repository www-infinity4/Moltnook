/* Moltnook verified agent room: only display project events with source links.
   Agent messages from this room are automatic routing notes, not proof of AI task execution. */
(function () {
  'use strict';
  var rosterRoot = document.getElementById('agent-roster');
  var activityRoot = document.getElementById('agent-activity');
  var roomStatus = document.getElementById('agent-room-status');
  var refresh = document.getElementById('agent-room-refresh');
  var filter = document.getElementById('agent-room-project');
  if (!rosterRoot || !activityRoot || !roomStatus) return;
  var ROLES = {};
  var lastFeed = [];
  function safeLink(s) {
    try {
      var url = new URL(s);
      return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : null;
    } catch (_) { return null; }
  }
  function el(tag, className, value) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (typeof value === 'string') n.textContent = value;
    return n;
  }
  function pill(label, className) {
    return el('span', 'oracle-mini-pill ' + (className || ''), label);
  }
  function showRoster(rows) {
    rosterRoot.replaceChildren();
    rows.forEach(function (r) {
      ROLES[r.id] = r;
      var card = el('article','oracle-agent-card tone-' + r.color);
      var top = el('div','oracle-agent-top');
      top.append(el('h3','',r.name),pill(r.color.toUpperCase(),'tone-' + r.color));
      card.append(top,el('p','oracle-agent-job',r.job));
      var detail = el('p','oracle-agent-detail','Writes: ' + r.writes.join(', ') + ' · Handoff: ' + r.handoff);
      card.append(detail);
      rosterRoot.append(card);
    });
  }
  function setProjects(items) {
    var current = filter.value;
    var names = Array.from(new Set(items.map(function (i) { return i.project; }).filter(Boolean))).sort();
    filter.replaceChildren();
    var all = document.createElement('option');all.value = 'all'; all.textContent = 'All projects';filter.append(all);
    names.forEach(function (name) { var option = document.createElement('option'); option.value = name; option.textContent = name;filter.append(option); });
    filter.value = names.includes(current) ? current : 'all';
  }
  function renderEvents() {
    activityRoot.replaceChildren();
    var shown = lastFeed.filter(function (item) { return filter.value === 'all' || item.project === filter.value; }).slice(0, 28);
    if (!shown.length) {
      activityRoot.append(el('p','oracle-agent-empty','No verified project events in this selection. No agent work is being claimed.'));
      return;
    }
    shown.forEach(function (item) {
      var role = ROLES[item.agent] || {name:'Project observer',color:'blue'};
      var card = el('article','oracle-event tone-' + role.color);
      var header = el('div','oracle-event-header');
      header.append(el('strong','',role.name),pill(item.phase || 'Observation'));
      var date = new Date(item.when);
      header.append(el('time','',isNaN(date.getTime()) ? 'Time unverified' : date.toLocaleString()));
      var to = item.to && ROLES[item.to] ? ROLES[item.to].name : (item.to || 'the project team');
      card.append(header,el('p','oracle-event-message','To ' + to + ': ' + item.message));
      var meta = el('div','oracle-event-meta');
      meta.append(pill(item.project || 'Infinity'),pill(item.kind || 'activity'));
      var link = safeLink(item.url);
      if (link) {
        var source = el('a','oracle-event-source','Open evidence ↗');
        source.href = link; source.target = '_blank'; source.rel = 'noopener noreferrer';
        meta.append(source);
      }
      card.append(meta); activityRoot.append(card);
    });
  }
  async function loadRoster() {
    var res = await fetch('agents/roster.json', {cache:'no-store'});
    if (!res.ok) throw new Error('roster request failed');
    var rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) throw new Error('empty roster');
    showRoster(rows);
  }
  async function fallback() {
    var response = await fetch('https://api.github.com/repos/www-infinity4/Moltnook/events?per_page=12', {
      headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
    if (!response.ok) throw new Error('Live events unavailable');
    var events = await response.json();
    return events.filter(function (x) {return x && x.repo && x.payload;}).map(function (x) {
      var pr = x.payload.pull_request, issue = x.payload.issue;
      var kind = x.type || 'Activity';
      var url = pr && pr.html_url || issue && issue.html_url || 'https://github.com/www-infinity4/Moltnook/commits/main';
      var title = pr && pr.title || issue && issue.title || kind;
      return {id:String(x.id),agent:kind.indexOf('Issue')>=0?'orange-peel':'pink-panther',
        to:'greenbeans',project:'Moltnook',kind:kind,phase:'Observed',
        when:x.created_at,url:url,message:'Project event: ' + title + '. Check its source before changing anything.'};
    });
  }
  async function readVerifiedExecutions() {
    // Only GitHub Actions in the user's Claude-Flow repository publishes this evidence.
    // These are measured tool actions, not invented AI conversations or successful deploys.
    try {
      var response = await fetch('https://raw.githubusercontent.com/www-infinity4/claude-flow/main/phi/state/moltnook-conversation.json?fresh=' + Date.now(), {cache:'no-store'});
      if (!response.ok) return [];
      var doc = await response.json();
      if (!doc || !Array.isArray(doc.messages)) return [];
      return doc.messages.filter(function (entry) {
        return entry && typeof entry.agent === 'string' && typeof entry.message === 'string'
          && typeof entry.when === 'string' && safeLink(entry.url);
      }).slice(-35);
    } catch (_) { return []; }
  }
  async function loadFeed() {
    if (refresh) refresh.disabled = true;
    roomStatus.textContent = 'Checking source-linked project activity…';
    try {
      var response = await fetch('https://raw.githubusercontent.com/www-infinity4/Moltnook/main/activity/feed.json?fresh=' + Date.now(), {cache:'no-store'});
      if (!response.ok) throw new Error('feed unavailable');
      var feed = await response.json();
      if (!Array.isArray(feed.items)) throw new Error('invalid feed');
      var executed = await readVerifiedExecutions();
      lastFeed = executed.concat(feed.items).sort(function (a,b) {
        return Date.parse(b.when || 0) - Date.parse(a.when || 0);
      });
      setProjects(lastFeed); renderEvents();
      var at = feed.generatedAt ? new Date(feed.generatedAt).toLocaleString() : 'unknown';
      roomStatus.textContent = executed.length + ' observed Claude-Flow tool events · ' + feed.items.length + ' project records · refreshed ' + at + '. Source checks do not prove model editing or deployed changes.';
    } catch (_) {
      try {
        var executedFallback = await readVerifiedExecutions();
        lastFeed = executedFallback.concat(await fallback()).sort(function(a,b){return Date.parse(b.when||0)-Date.parse(a.when||0);});
        setProjects(lastFeed);renderEvents();
        roomStatus.textContent = 'Live GitHub fallback and ' + executedFallback.length + ' verified tool events; project feed currently unavailable.';
      } catch (_) {
        activityRoot.replaceChildren(el('p','oracle-agent-empty','Source activity is temporarily unavailable. No active work can be verified.'));
        roomStatus.textContent = 'Could not verify activity. The room will not invent agent conversations.';
      }
    } finally { if (refresh) refresh.disabled = false; }
  }
  if (refresh) refresh.addEventListener('click',loadFeed);
  if (filter) filter.addEventListener('change',renderEvents);
  loadRoster().then(loadFeed).catch(function () {
    roomStatus.textContent = 'Agent roster unavailable; cannot verify activity.';
  });
  document.addEventListener('visibilitychange',function () { if (!document.hidden) loadFeed(); });
  setInterval(function () { if (!document.hidden) loadFeed(); },120000);
}());