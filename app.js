(function(){
"use strict";
var KEY = "sideline-stats.v1";
var POSITIONS = ["Outside hitter","Opposite","Middle blocker","Setter","Libero","Defensive specialist"];
var GROUPS = [
  {id:"serve", name:"Serve", items:[{k:"srv_ace",l:"Ace",t:"good"},{k:"srv_in",l:"In",t:"mid"},{k:"srv_err",l:"Error",t:"bad"}]},
  {id:"receive", name:"Serve receive", items:[{k:"rec_3",l:"Perfect",tag:"3",t:"good"},{k:"rec_2",l:"Good",tag:"2",t:"mid"},{k:"rec_1",l:"Poor",tag:"1",t:"mid"},{k:"rec_0",l:"Aced",tag:"0",t:"bad"}]},
  {id:"attack", name:"Attack", items:[{k:"atk_kill",l:"Kill",t:"good"},{k:"atk_play",l:"In play",t:"mid"},{k:"atk_err",l:"Error",t:"bad"}]},
  {id:"block", name:"Block", items:[{k:"blk_solo",l:"Solo",t:"good"},{k:"blk_ast",l:"Assist",t:"good"},{k:"blk_err",l:"Error",t:"bad"}]},
  {id:"defense", name:"Defense", items:[{k:"dig",l:"Dig",t:"good"},{k:"dig_err",l:"Missed",t:"bad"}]},
  {id:"setting", name:"Setting", items:[{k:"set_ast",l:"Assist",t:"good"},{k:"set_err",l:"Error",t:"bad"}]}
];
var LABEL = {};
GROUPS.forEach(function(g){ g.items.forEach(function(i){ LABEL[i.k] = g.name + " " + i.l.toLowerCase(); }); });

function skillsFor(pos){
  var s = {serve:true, receive:true, attack:true, block:true, defense:true, setting:false};
  if (pos === "Setter"){ s.setting = true; s.receive = false; }
  if (pos === "Libero" || pos === "Defensive specialist"){ s.attack = false; s.block = false; }
  if (pos === "Middle blocker"){ s.receive = false; }
  return s;
}

/* ---------- storage ---------- */
function load(){
  var s = null;
  try { var raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw); } catch(e){}
  var base = {player:null, matches:[], activeId:null, tab:"track", trend:"kps"};
  if (s && typeof s === "object"){ for (var k in s) base[k] = s[k]; }
  if (!Array.isArray(base.matches)) base.matches = [];
  return base;
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){} }
var state = load();
var editing = false;
var pendingEnd = 0, pendingDel = null, showRestore = false, copyFallback = "";

/* ---------- helpers ---------- */
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function today(){ var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
function niceDate(d){ try { return new Date(d + "T12:00:00").toLocaleDateString(undefined,{month:"short", day:"numeric"}); } catch(e){ return d; } }
function val(id){ var el = document.getElementById(id); return el ? el.value.trim() : ""; }
function active(){ for (var i=0;i<state.matches.length;i++){ if (state.matches[i].id === state.activeId) return state.matches[i]; } return null; }
function skills(){ return (state.player && state.player.skills) || skillsFor(""); }
function vibrate(){ try { if (navigator.vibrate) navigator.vibrate(10); } catch(e){} }

function counts(log){
  var c = {};
  GROUPS.forEach(function(g){ g.items.forEach(function(i){ c[i.k] = 0; }); });
  log.forEach(function(e){ if (e.k in c) c[e.k]++; });
  return c;
}
function metrics(c, sets){
  var ta = c.atk_kill + c.atk_play + c.atk_err;
  var serves = c.srv_ace + c.srv_in + c.srv_err;
  var recs = c.rec_3 + c.rec_2 + c.rec_1 + c.rec_0;
  return {
    c:c, sets:sets,
    kills:c.atk_kill, atkErr:c.atk_err, ta:ta, hit: ta ? (c.atk_kill - c.atk_err)/ta : null,
    aces:c.srv_ace, serves:serves, servePct: serves ? (c.srv_ace + c.srv_in)/serves : null, srvErr:c.srv_err,
    recs:recs, pass: recs ? (3*c.rec_3 + 2*c.rec_2 + c.rec_1)/recs : null,
    digs:c.dig, blocks: c.blk_solo + 0.5*c.blk_ast, assists:c.set_ast
  };
}
function fHit(v){ if (v == null) return "–"; var s = Math.abs(v).toFixed(3).replace(/^0/, ""); return (v < 0 ? "-" : "") + s; }
function fPct(v){ return v == null ? "–" : Math.round(v*100) + "%"; }
function fPass(v){ return v == null ? "–" : v.toFixed(2); }
function per(n, sets){ return sets ? (n/sets).toFixed(2) : "–"; }
function fNum(n){ return Number.isInteger(n) ? String(n) : n.toFixed(1); }

function playedMatches(){ return state.matches.filter(function(m){ return m.log.length > 0; }); }
function seasonAgg(){
  var ms = playedMatches();
  var log = []; var sets = 0;
  ms.forEach(function(m){ log = log.concat(m.log); sets += m.sets || 0; });
  var mt = metrics(counts(log), sets); mt.matches = ms.length; return mt;
}

/* ---------- views ---------- */
function band(extra){
  var p = state.player;
  var sub = [p.position, p.team || p.club].filter(Boolean).join(", ");
  return '<header class="band"><div class="band-row">' +
    (p.number ? '<div class="jersey" aria-label="Jersey number">' + esc(p.number) + '</div>' : '') +
    '<div><h1>' + esc(p.name) + '</h1>' + (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') + '</div></div>' +
    (extra || '') + '</header>';
}

function field(id, label, value, type, ph, extra){
  return '<label class="field"><span>' + label + '</span><input id="f_' + id + '" type="' + (type||"text") + '" value="' + esc(value||"") + '" placeholder="' + esc(ph||"") + '" ' + (extra||"") + '></label>';
}

function viewSetup(){
  var p = state.player || {};
  var sk = p.skills || skillsFor(p.position || "");
  var pos = '<label class="field"><span>Position</span><select id="f_position"><option value="">Choose a position</option>' +
    POSITIONS.map(function(x){ return '<option' + (p.position === x ? ' selected' : '') + '>' + x + '</option>'; }).join("") + '</select></label>';
  var checks = GROUPS.map(function(g){
    return '<label class="check"><input type="checkbox" id="sk_' + g.id + '"' + (sk[g.id] ? ' checked' : '') + '><span>' + g.name + '</span></label>';
  }).join("");
  return '<div class="intro"><h1>' + (state.player ? "Edit player" : "Set up your player") + '</h1>' +
    '<p>This information builds their recruiting profile. Only the name is required, and you can add the rest later.</p></div>' +
    '<section class="panel">' +
      field("name","Player name",p.name,"text","Maya Tremblay",'autocomplete="off"') +
      '<div id="nameErr"></div>' +
      '<div class="row2">' + field("number","Jersey number",p.number,"text","12",'inputmode="numeric" maxlength="3"') + pos + '</div>' +
      '<div class="row2">' + field("grad","Graduating year",p.grad,"text","2028",'inputmode="numeric" maxlength="4"') + field("height","Height",p.height,"text","5\'10\"") + '</div>' +
      '<div class="row2">' + field("club","Club",p.club,"text","Quinte Thunder") + field("team","Team",p.team,"text","17U") + '</div>' +
      field("home","Hometown",p.home,"text","Belleville, ON") +
      field("email","Contact email for coaches",p.email,"email","family@example.com") +
      field("video","Highlight video link",p.video,"url","https://youtube.com/...") +
      '<fieldset><legend>Skills to track</legend><div class="checks">' + checks + '</div></fieldset>' +
      '<div class="stack"><button class="primary" data-act="saveplayer">Save player</button>' +
      (state.player ? '<button class="ghost" data-act="canceledit">Cancel</button>' : '') + '</div>' +
    '</section>';
}

function liveLine(mt){
  var sk = skills(); var parts = [];
  if (sk.attack) { parts.push(["Kills", mt.kills]); parts.push(["Hit", fHit(mt.hit)]); }
  if (sk.setting) parts.push(["Assists", mt.assists]);
  if (sk.serve) parts.push(["Aces", mt.aces]);
  if (sk.defense) parts.push(["Digs", mt.digs]);
  if (sk.receive) parts.push(["Pass", fPass(mt.pass)]);
  if (sk.block && !sk.receive) parts.push(["Blocks", fNum(mt.blocks)]);
  return '<div class="live" aria-label="This match">' + parts.slice(0,5).map(function(p){ return '<div>' + p[0] + ' <b>' + p[1] + '</b></div>'; }).join("") + '</div>';
}

function groupNote(g, mt){
  switch(g.id){
    case "serve": return mt.serves ? fPct(mt.servePct) + " in" : "";
    case "receive": return mt.recs ? "Avg " + fPass(mt.pass) : "";
    case "attack": return mt.ta ? "Hitting " + fHit(mt.hit) : "";
    case "block": return mt.blocks ? fNum(mt.blocks) + " total" : "";
    case "defense": return mt.digs ? mt.digs + " digs" : "";
    case "setting": return mt.assists ? mt.assists + " assists" : "";
  }
  return "";
}

function viewTrack(){
  var m = active();
  if (!m){
    return band() +
      '<section class="panel"><h2>Start a match</h2>' +
        field("event","Tournament or event","", "text","OVA Cup 2") +
        field("opp","Opponent","", "text","Kingston Pacers") +
        field("date","Date",today(),"date") +
        '<button class="primary" data-act="startmatch">Start tracking</button>' +
        '<p class="hint">Stats save on this phone as you tap.</p>' +
      '</section>';
  }
  var mt = metrics(counts(m.log), m.sets);
  var title = '<div class="live" style="border-top:0;margin-top:10px;padding-top:0"><div style="color:#fff;font-weight:600;font-size:15px">vs ' + esc(m.opp || "Opponent") + (m.event ? '<span style="font-weight:400;color:rgba(255,255,255,.75)">&nbsp; at ' + esc(m.event) + '</span>' : '') + '</div></div>';
  var setBtns = '';
  for (var i=1;i<=m.sets;i++) setBtns += '<button class="pill' + (m.set === i ? ' on' : '') + '" data-act="set:' + i + '" aria-pressed="' + (m.set === i) + '">Set ' + i + '</button>';
  if (m.sets < 5) setBtns += '<button class="pill add" data-act="addset">Next set</button>';
  var sk = skills();
  var groups = GROUPS.filter(function(g){ return sk[g.id]; }).map(function(g){
    return '<section class="group" aria-label="' + g.name + '"><div class="group-head"><h2>' + g.name + '</h2><span>' + groupNote(g, mt) + '</span></div>' +
      '<div class="btns" style="--n:' + g.items.length + '">' + g.items.map(function(it){
        return '<button class="stat ' + it.t + '" data-act="stat:' + it.k + '" aria-label="' + esc(LABEL[it.k]) + ', ' + mt.c[it.k] + ' so far">' +
          (it.tag ? '<span class="tag">' + it.tag + '</span>' : '') +
          '<span>' + it.l + '</span><span class="n">' + mt.c[it.k] + '</span></button>';
      }).join("") + '</div></section>';
  }).join("");
  if (!groups) groups = '<p class="hint">No skills are turned on. Edit the player on the Profile tab to choose what to track.</p>';
  return band(title + liveLine(mt)) +
    '<div class="sets"><span class="lead">Tapping into</span>' + setBtns + '</div>' + groups;
}

function trendValues(ms, key){
  return ms.map(function(m){
    var mt = metrics(counts(m.log), m.sets);
    switch(key){
      case "kps": return mt.sets ? mt.kills/mt.sets : null;
      case "hit": return mt.hit;
      case "dps": return mt.sets ? mt.digs/mt.sets : null;
      case "pass": return mt.pass;
      case "aps": return mt.sets ? mt.aces/mt.sets : null;
      case "asps": return mt.sets ? mt.assists/mt.sets : null;
    }
    return null;
  });
}
function trendSvg(vals, fmt){
  var pts = [];
  vals.forEach(function(v,i){ if (v != null) pts.push({v:v,i:i}); });
  if (pts.length < 2) return '<p class="muted small" style="padding:10px 4px">Track two or more matches to see a trend line.</p>';
  var W=320, H=140, px=22, pt=22, pb=22;
  var min = Math.min.apply(null, pts.map(function(p){return p.v;}));
  var max = Math.max.apply(null, pts.map(function(p){return p.v;}));
  if (min === max){ var pad = Math.abs(max)*0.25 || 0.5; min -= pad; max += pad; }
  var n = vals.length;
  function x(i){ return px + (n === 1 ? 0 : (i/(n-1))*(W-2*px)); }
  function y(v){ return pt + (1 - (v-min)/(max-min))*(H-pt-pb); }
  var line = pts.map(function(p){ return x(p.i).toFixed(1) + "," + y(p.v).toFixed(1); }).join(" ");
  var zero = (min < 0 && max > 0) ? '<line x1="' + px + '" x2="' + (W-px) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="var(--line)" stroke-dasharray="4 4"/>' : '';
  var dots = pts.map(function(p){ return '<circle cx="' + x(p.i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="4.5" fill="var(--ball)" stroke="currentColor" stroke-width="2"/>'; }).join("");
  var first = pts[0], last = pts[pts.length-1];
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Trend from ' + fmt(first.v) + ' to ' + fmt(last.v) + ' across ' + pts.length + ' matches">' + zero +
    '<polyline points="' + line + '" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' + dots +
    '<text x="' + x(first.i) + '" y="' + (y(first.v)-10) + '" text-anchor="start">' + fmt(first.v) + '</text>' +
    '<text x="' + x(last.i) + '" y="' + (y(last.v)-10) + '" text-anchor="end">' + fmt(last.v) + '</text>' +
    '<text class="axis" x="' + px + '" y="' + (H-4) + '">First match</text>' +
    '<text class="axis" x="' + (W-px) + '" y="' + (H-4) + '" text-anchor="end">Latest</text></svg>';
}

function matchTable(m){
  var rows = '';
  for (var s=1; s<=m.sets; s++){
    var c = counts(m.log.filter(function(e){ return e.s === s; }));
    var mt = metrics(c, 1);
    rows += '<tr><td>Set ' + s + '</td><td>' + mt.kills + '</td><td>' + mt.atkErr + '</td><td>' + mt.ta + '</td><td>' + mt.aces + '</td><td>' + mt.digs + '</td><td>' + fNum(mt.blocks) + '</td><td>' + mt.assists + '</td></tr>';
  }
  return '<div class="tbl-wrap"><table><thead><tr><th>Set</th><th>K</th><th>E</th><th>TA</th><th>Aces</th><th>Digs</th><th>Blk</th><th>Ast</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function viewSeason(){
  var ms = playedMatches();
  if (!ms.length){
    return band() + '<div class="empty"><h2>No matches yet</h2><p>Track your first match and season stats will build up here.</p><button class="primary" style="max-width:260px" data-act="tab:track">Start a match</button></div>';
  }
  var a = seasonAgg(); var sk = skills(); var S = a.sets;
  var rows = '<div class="r"><span>Matches tracked</span><b>' + a.matches + '</b></div><div class="r"><span>Sets played</span><b>' + S + '</b></div>';
  if (sk.attack || a.ta) rows += '<div class="grp">Attack</div><div class="r"><span>Kills per set</span><b>' + per(a.kills,S) + '</b></div><div class="r"><span>Hitting percentage</span><b>' + fHit(a.hit) + '</b></div><div class="r"><span>Kills, errors, attempts</span><b>' + a.kills + ' / ' + a.atkErr + ' / ' + a.ta + '</b></div>';
  if (sk.setting || a.assists) rows += '<div class="grp">Setting</div><div class="r"><span>Assists per set</span><b>' + per(a.assists,S) + '</b></div>';
  if (sk.serve || a.serves) rows += '<div class="grp">Serve</div><div class="r"><span>Aces per set</span><b>' + per(a.aces,S) + '</b></div><div class="r"><span>Serves in</span><b>' + fPct(a.servePct) + '</b></div><div class="r"><span>Service errors per set</span><b>' + per(a.srvErr,S) + '</b></div>';
  if (sk.receive || a.recs) rows += '<div class="grp">Serve receive</div><div class="r"><span>Pass rating (0 to 3)</span><b>' + fPass(a.pass) + '</b></div><div class="r"><span>Receptions</span><b>' + a.recs + '</b></div>';
  if (sk.defense || a.digs) rows += '<div class="grp">Defense</div><div class="r"><span>Digs per set</span><b>' + per(a.digs,S) + '</b></div>';
  if (sk.block || a.blocks) rows += '<div class="grp">Block</div><div class="r"><span>Blocks per set</span><b>' + per(a.blocks,S) + '</b></div>';

  var opts = [];
  if (sk.attack) { opts.push(["kps","Kills per set"]); opts.push(["hit","Hitting %"]); }
  if (sk.setting) opts.push(["asps","Assists per set"]);
  if (sk.defense) opts.push(["dps","Digs per set"]);
  if (sk.receive) opts.push(["pass","Pass rating"]);
  if (sk.serve) opts.push(["aps","Aces per set"]);
  if (!opts.length) opts.push(["dps","Digs per set"]);
  var key = state.trend;
  if (!opts.some(function(o){ return o[0] === key; })) key = opts[0][0];
  var fmt = key === "hit" ? fHit : function(v){ return v.toFixed(2); };
  var chips = opts.map(function(o){ return '<button class="pill' + (o[0] === key ? ' on' : '') + '" data-act="trend:' + o[0] + '">' + o[1] + '</button>'; }).join("");

  var list = ms.slice().reverse().map(function(m){
    var mt = metrics(counts(m.log), m.sets);
    var isActive = m.id === state.activeId;
    var line = [mt.kills + " K", fHit(mt.hit) + " hit", mt.aces + " aces", mt.digs + " digs"].join(", ");
    var del = pendingDel && pendingDel.id === m.id;
    return '<details class="match"><summary><div class="t">' + niceDate(m.date) + (m.event ? " at " + esc(m.event) : "") + (isActive ? '<span class="badge">In progress</span>' : '') + '</div>' +
      '<div class="s">vs ' + esc(m.opp || "Opponent") + ', ' + m.sets + (m.sets === 1 ? " set" : " sets") + ', ' + line + '</div></summary>' +
      '<div class="body">' + matchTable(m) +
      '<div class="row2">' + (isActive ? '<button class="ghost" data-act="tab:track">Back to tracking</button>' : '<button class="ghost" data-act="resume:' + m.id + '">Reopen match</button>') +
      '<button class="ghost danger' + (del ? ' confirm' : '') + '" data-act="del:' + m.id + '">' + (del ? 'Tap again to delete' : 'Delete match') + '</button></div></div></details>';
  }).join("");

  return band() +
    '<h2 class="section-title">Season</h2><div class="sheet">' + rows + '</div>' +
    '<h2 class="section-title">Trend</h2><div class="chips">' + chips + '</div><div class="chart">' + trendSvg(trendValues(ms, key), fmt) + '</div>' +
    '<h2 class="section-title">Matches</h2>' + list;
}

function keyStats(a){
  var p = state.player.position, S = a.sets;
  if (p === "Setter") return [["Assists/set",per(a.assists,S)],["Aces/set",per(a.aces,S)],["Digs/set",per(a.digs,S)],["Serves in",fPct(a.servePct)]];
  if (p === "Libero" || p === "Defensive specialist") return [["Pass rating",fPass(a.pass)],["Digs/set",per(a.digs,S)],["Serves in",fPct(a.servePct)],["Aces/set",per(a.aces,S)]];
  if (p === "Middle blocker") return [["Kills/set",per(a.kills,S)],["Hitting",fHit(a.hit)],["Blocks/set",per(a.blocks,S)],["Serves in",fPct(a.servePct)]];
  return [["Kills/set",per(a.kills,S)],["Hitting",fHit(a.hit)],["Aces/set",per(a.aces,S)],["Digs/set",per(a.digs,S)]];
}

function profileText(){
  var p = state.player, a = seasonAgg();
  var L = [];
  L.push(p.name + (p.number ? " #" + p.number : ""));
  var l2 = [p.position, p.grad ? "Class of " + p.grad : ""].filter(Boolean).join(", "); if (l2) L.push(l2);
  var l3 = [p.club, p.team].filter(Boolean).join(" "); if (l3) L.push("Club: " + l3);
  if (p.height) L.push("Height: " + p.height);
  if (p.home) L.push("Hometown: " + p.home);
  if (a.matches){
    L.push("");
    L.push("Season stats (" + a.matches + " matches, " + a.sets + " sets):");
    keyStats(a).forEach(function(k){ L.push("  " + k[0] + ": " + k[1]); });
    if (a.ta) L.push("  Kills / errors / attempts: " + a.kills + " / " + a.atkErr + " / " + a.ta);
  }
  if (p.video){ L.push(""); L.push("Highlights: " + p.video); }
  if (p.email) L.push("Contact: " + p.email);
  return L.join("\n");
}

function viewProfile(){
  var p = state.player, a = seasonAgg();
  var meta1 = [p.position, p.grad ? "Class of " + p.grad : ""].filter(Boolean).join(", ");
  var meta2 = [p.club, p.team].filter(Boolean).join(" ");
  var stats = keyStats(a).map(function(k){ return '<div><b>' + k[1] + '</b><span>' + k[0] + '</span></div>'; }).join("");
  var facts = [];
  if (p.height) facts.push(["Height", esc(p.height)]);
  if (p.home) facts.push(["Hometown", esc(p.home)]);
  if (p.video) { var safe = /^https?:\/\//i.test(p.video) ? p.video : "https://" + p.video; facts.push(["Highlights", '<a href="' + esc(safe) + '" target="_blank" rel="noopener">Watch video</a>']); }
  if (p.email) facts.push(["Contact", esc(p.email)]);
  var factsHtml = facts.length ? '<div class="facts">' + facts.map(function(f){ return '<div class="r"><span>' + f[0] + '</span><span>' + f[1] + '</span></div>'; }).join("") + '</div>' : '';
  var missing = [];
  if (!p.grad) missing.push("graduating year"); if (!p.video) missing.push("highlight link"); if (!p.email) missing.push("contact email");
  var nudge = missing.length ? '<p class="hint">Coaches look for a ' + missing.join(", ").replace(/, ([^,]*)$/, " and $1") + '. Add them with Edit player.</p>' : '';

  return '<article class="card" aria-label="Recruiting profile">' +
      '<div class="card-top">' + (p.number ? '<div class="jersey">' + esc(p.number) + '</div>' : '') +
      '<div><h1>' + esc(p.name) + '</h1>' + (meta1 ? '<p class="meta">' + esc(meta1) + '</p>' : '') + (meta2 ? '<p class="meta">' + esc(meta2) + '</p>' : '') + '</div></div>' +
      '<div class="card-stats">' + stats + '</div>' +
      '<p class="card-foot">' + (a.matches ? "From " + a.matches + (a.matches === 1 ? " match, " : " matches, ") + a.sets + (a.sets === 1 ? " set" : " sets") + " tracked this season" : "Stats appear here once you track a match") + '</p>' +
    '</article>' + factsHtml + nudge +
    '<div class="stack" style="margin-top:14px"><button class="primary" data-act="copyprofile">Copy profile for an email</button>' +
    '<button class="ghost" data-act="editplayer">Edit player</button></div>' +
    (copyFallback ? '<section class="panel"><h2>Copy this text</h2><textarea id="copyBox" readonly>' + esc(copyFallback) + '</textarea><p class="hint">Press and hold to select all, then copy.</p></section>' : '') +
    '<section class="panel"><h2>Back up your stats</h2><p class="muted">Stats are saved in this browser on this phone. Copy a backup code and keep it in your notes so a cleared browser never costs you a season.</p>' +
      '<div class="stack" style="margin-top:12px"><button class="ghost" data-act="copybackup">Copy backup code</button>' +
      (showRestore ? '<textarea id="restoreBox" placeholder="Paste a backup code here"></textarea><div id="restoreErr"></div><button class="primary" data-act="dorestore">Restore stats</button>' : '<button class="ghost" data-act="showrestore">Restore from a backup code</button>') +
    '</div></section>';
}

/* ---------- render ---------- */
var app = document.getElementById("app"), nav = document.getElementById("nav"), bar = document.getElementById("bar");
var ICONS = {
  track:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5v14M10 5v14M15 5v14M3 17L18 7"/><circle cx="19.5" cy="17.5" r="2.5"/></svg>',
  season:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/></svg>',
  profile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.5c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h4M14.5 13.5h3"/></svg>'
};
function render(){
  if (!state.player || editing){
    app.innerHTML = viewSetup();
    nav.innerHTML = ""; nav.hidden = true; bar.innerHTML = "";
    var sel = document.getElementById("f_position");
    if (sel) sel.addEventListener("change", function(){
      var s = skillsFor(sel.value);
      GROUPS.forEach(function(g){ var cb = document.getElementById("sk_" + g.id); if (cb) cb.checked = s[g.id]; });
    });
    return;
  }
  nav.hidden = false;
  var t = state.tab;
  app.innerHTML = t === "season" ? viewSeason() : t === "profile" ? viewProfile() : viewTrack();
  var m = active();
  if (t === "track" && m){
    bar.innerHTML = '<div class="actionbar"><div class="in"><button class="ghost" data-act="undo"' + (m.log.length ? '' : ' disabled') + '>Undo last tap</button>' +
      '<button class="ghost' + (pendingEnd ? ' confirm' : '') + '" data-act="endmatch">' + (pendingEnd ? 'Tap again to end' : 'End match') + '</button></div></div>';
  } else bar.innerHTML = "";
  nav.innerHTML = '<div class="in">' + [["track","Track"],["season","Season"],["profile","Profile"]].map(function(x){
    return '<button data-act="tab:' + x[0] + '" class="' + (t === x[0] ? 'on' : '') + '"' + (t === x[0] ? ' aria-current="page"' : '') + '>' + ICONS[x[0]] + x[1] + '</button>';
  }).join("") + '</div>';
  var cb = document.getElementById("copyBox"); if (cb) { cb.focus(); cb.select(); }
}

var toastTimer;
function toast(msg){
  var el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.classList.remove("show"); }, 2200);
}

function copyText(text, okMsg){
  var done = function(){ copyFallback = ""; toast(okMsg); render(); };
  var fail = function(){ copyFallback = text; render(); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
    else fail();
  } catch(e){ fail(); }
}

var endTimer, delTimer;
document.addEventListener("click", function(e){
  var el = e.target.closest("[data-act]"); if (!el) return;
  var parts = el.getAttribute("data-act").split(":"), act = parts[0], arg = parts[1];
  var m = active();
  switch(act){
    case "tab":
      state.tab = arg; pendingEnd = 0; pendingDel = null; copyFallback = ""; showRestore = false;
      save(); render(); window.scrollTo(0,0); break;
    case "stat":
      if (!m) return;
      m.log.push({k:arg, s:m.set, t:Date.now()}); save(); vibrate(); render();
      var b = document.querySelector('[data-act="stat:' + arg + '"]'); if (b) b.classList.add("flash");
      break;
    case "set": if (m){ m.set = parseInt(arg,10); save(); render(); } break;
    case "addset": if (m && m.sets < 5){ m.sets++; m.set = m.sets; save(); render(); toast("Now tapping into set " + m.set); } break;
    case "undo":
      if (m && m.log.length){ var last = m.log.pop(); save(); render(); toast("Removed " + LABEL[last.k] + " (set " + last.s + ")"); }
      break;
    case "endmatch":
      if (!m) return;
      if (pendingEnd){
        clearTimeout(endTimer); pendingEnd = 0;
        m.done = true; state.activeId = null;
        if (!m.log.length) state.matches = state.matches.filter(function(x){ return x.id !== m.id; });
        state.tab = m.log.length ? "season" : "track"; save(); render(); window.scrollTo(0,0);
        toast(m.log.length ? "Match saved to your season" : "Empty match discarded");
      } else {
        pendingEnd = Date.now(); render();
        endTimer = setTimeout(function(){ pendingEnd = 0; render(); }, 3500);
      }
      break;
    case "startmatch":
      var nm = {id:uid(), date:val("f_date") || today(), event:val("f_event"), opp:val("f_opp"), sets:1, set:1, log:[], done:false};
      state.matches.push(nm); state.activeId = nm.id; save(); render(); window.scrollTo(0,0);
      break;
    case "resume":
      var r = state.matches.filter(function(x){ return x.id === arg; })[0];
      if (r){
        if (m && m.id !== r.id) m.done = true;
        r.done = false; state.activeId = r.id; state.tab = "track"; save(); render(); window.scrollTo(0,0);
      }
      break;
    case "del":
      if (pendingDel && pendingDel.id === arg){
        clearTimeout(delTimer); pendingDel = null;
        state.matches = state.matches.filter(function(x){ return x.id !== arg; });
        if (state.activeId === arg) state.activeId = null;
        save(); render(); toast("Match deleted");
      } else {
        pendingDel = {id:arg}; render();
        var d = document.querySelector('[data-act="del:' + arg + '"]'); if (d) d.closest("details").open = true;
        delTimer = setTimeout(function(){ pendingDel = null; if (state.tab === "season"){ var openId = arg; render(); var dd = document.querySelector('[data-act="del:' + openId + '"]'); if (dd) dd.closest("details").open = true; } }, 3500);
      }
      break;
    case "trend": state.trend = arg; save(); render(); break;
    case "saveplayer":
      var name = val("f_name");
      if (!name){ document.getElementById("nameErr").innerHTML = '<p class="err" style="margin:-6px 0 12px">Enter the player\'s name to continue.</p>'; document.getElementById("f_name").focus(); return; }
      var sk = {}; GROUPS.forEach(function(g){ var cb = document.getElementById("sk_" + g.id); sk[g.id] = !!(cb && cb.checked); });
      state.player = {name:name, number:val("f_number"), position:val("f_position"), grad:val("f_grad"), height:val("f_height"), club:val("f_club"), team:val("f_team"), home:val("f_home"), email:val("f_email"), video:val("f_video"), skills:sk};
      var wasEditing = editing; editing = false;
      if (!wasEditing) state.tab = "track";
      save(); render(); window.scrollTo(0,0); toast("Player saved");
      break;
    case "canceledit": editing = false; render(); window.scrollTo(0,0); break;
    case "editplayer": editing = true; copyFallback = ""; render(); window.scrollTo(0,0); break;
    case "copyprofile": copyText(profileText(), "Profile copied. Paste it into an email."); break;
    case "copybackup":
      var code = "";
      try { code = btoa(unescape(encodeURIComponent(JSON.stringify({v:1, player:state.player, matches:state.matches})))); } catch(err){}
      copyText(code, "Backup code copied. Paste it somewhere safe.");
      break;
    case "showrestore": showRestore = true; render(); var rb = document.getElementById("restoreBox"); if (rb) rb.focus(); break;
    case "dorestore":
      var raw = val("restoreBox");
      try {
        var data = JSON.parse(decodeURIComponent(escape(atob(raw))));
        if (!data || !data.player || !Array.isArray(data.matches)) throw new Error("bad");
        state.player = data.player; state.matches = data.matches; state.activeId = null; state.tab = "season";
        showRestore = false; save(); render(); window.scrollTo(0,0); toast("Stats restored");
      } catch(err){
        document.getElementById("restoreErr").innerHTML = '<p class="err">That code didn\'t work. Copy the whole backup code and paste it again.</p>';
      }
      break;
  }
});

render();

/* ---------- offline support ---------- */
// Service workers only run on https:// or localhost, so skip quietly anywhere else.
if ("serviceWorker" in navigator && window.isSecureContext){
  window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
}
})();
