/* AEO Radar assistant widget. Self-contained: injects its own CSS and DOM. */
(function () {
  'use strict';
  if (window.__aeoChatLoaded) return;
  window.__aeoChatLoaded = true;

  var WORKER_URL = 'https://aeohelper-api.aeohelper.workers.dev';
  var SUGGESTIONS = ['What is in the $29 Fix Kit?', 'How do I unlock after paying?', 'Do AI tools use llms.txt?', 'How do I get a refund?'];
  var history = [];
  var busy = false;

  var css = [
    '#aeo-chat-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:8px;background:#2563eb;color:#fff;border:none;border-radius:999px;padding:13px 18px;font:600 14.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;cursor:pointer;box-shadow:0 6px 24px rgba(37,99,235,.35)}',
    '#aeo-chat-btn:hover{background:#1d4ed8}',
    '#aeo-chat-btn:focus-visible,#aeo-chat-panel button:focus-visible,#aeo-chat-panel input:focus-visible{outline:3px solid rgba(37,99,235,.35);outline-offset:2px}',
    '#aeo-chat-panel{position:fixed;right:20px;bottom:20px;z-index:2147483001;width:370px;max-width:calc(100vw - 24px);height:540px;max-height:calc(100vh - 40px);background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 12px 48px rgba(15,23,42,.18);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a}',
    '#aeo-chat-panel.open{display:flex}',
    '#aeo-chat-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc}',
    '#aeo-chat-head strong{font-size:15px;display:block}',
    '#aeo-chat-head span{font-size:12px;color:#64748b}',
    '#aeo-chat-close{background:transparent;border:none;color:#64748b;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px}',
    '#aeo-chat-close:hover{background:#e2e8f0}',
    '#aeo-chat-log{flex:1;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px;background:#fff}',
    '.aeo-msg{max-width:88%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}',
    '.aeo-msg.bot{align-self:flex-start;background:#f1f5f9;color:#0f172a;border-bottom-left-radius:4px}',
    '.aeo-msg.me{align-self:flex-end;background:#2563eb;color:#fff;border-bottom-right-radius:4px}',
    '.aeo-msg.err{align-self:flex-start;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}',
    '.aeo-typing{align-self:flex-start;color:#64748b;font-size:13px;padding:4px 6px}',
    '#aeo-chat-sugg{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}',
    '#aeo-chat-sugg button{background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;border-radius:999px;padding:6px 11px;font:500 12.5px/1.2 inherit;font-family:inherit;cursor:pointer}',
    '#aeo-chat-sugg button:hover{background:#dbeafe}',
    '#aeo-chat-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e2e8f0;background:#fff}',
    '#aeo-chat-input{flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:11px;padding:10px 12px;font:14px/1.3 inherit;font-family:inherit;color:#0f172a;background:#fff}',
    '#aeo-chat-send{background:#2563eb;color:#fff;border:none;border-radius:11px;padding:0 16px;font:600 14px/1 inherit;font-family:inherit;cursor:pointer}',
    '#aeo-chat-send:disabled{opacity:.5;cursor:not-allowed}',
    '#aeo-chat-note{font-size:11.5px;color:#94a3b8;text-align:center;padding:0 12px 10px;background:#fff}',
    '@media (max-width:560px){#aeo-chat-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100vh;max-height:100vh;border-radius:0}#aeo-chat-btn{right:14px;bottom:14px}}',
    '@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function el(tag, props, text) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { n.setAttribute(k, props[k]); });
    if (text !== undefined) n.textContent = text;
    return n;
  }

  var btn = el('button', { id: 'aeo-chat-btn', type: 'button', 'aria-haspopup': 'dialog', 'aria-controls': 'aeo-chat-panel' }, '💬 Ask a question');
  var panel = el('div', { id: 'aeo-chat-panel', role: 'dialog', 'aria-label': 'AEO Radar assistant' });

  var head = el('div', { id: 'aeo-chat-head' });
  var titleWrap = el('div');
  titleWrap.appendChild(el('strong', null, 'AEO Radar assistant'));
  titleWrap.appendChild(el('span', null, 'Payments, the Fix Kit, AEO & SEO'));
  var closeBtn = el('button', { id: 'aeo-chat-close', type: 'button', 'aria-label': 'Close chat' }, '×');
  head.appendChild(titleWrap);
  head.appendChild(closeBtn);

  var log = el('div', { id: 'aeo-chat-log', role: 'log', 'aria-live': 'polite' });
  var sugg = el('div', { id: 'aeo-chat-sugg' });
  var form = el('form', { id: 'aeo-chat-form', autocomplete: 'off' });
  var input = el('input', { id: 'aeo-chat-input', type: 'text', maxlength: '600', placeholder: 'Ask about payments, the kit, AEO...', 'aria-label': 'Your question' });
  var send = el('button', { id: 'aeo-chat-send', type: 'submit' }, 'Send');
  form.appendChild(input);
  form.appendChild(send);
  var note = el('div', { id: 'aeo-chat-note' }, 'AI assistant. Never share card details or license keys here.');

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(sugg);
  panel.appendChild(form);
  panel.appendChild(note);
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  function addMsg(text, kind) {
    var m = el('div', { class: 'aeo-msg ' + kind }, text);
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function renderSuggestions() {
    sugg.textContent = '';
    SUGGESTIONS.forEach(function (s) {
      var b = el('button', { type: 'button' }, s);
      b.addEventListener('click', function () { ask(s); });
      sugg.appendChild(b);
    });
  }

  function scanContext() {
    var area = document.getElementById('resultsArea');
    if (!area || area.style.display === 'none') return null;
    var scoreEl = document.getElementById('scoreVal');
    var score = scoreEl ? parseInt(scoreEl.textContent, 10) : NaN;
    var domEl = document.getElementById('scannedDomain');
    var gradeEl = document.getElementById('gradeBadge');
    var fixes = Array.prototype.slice.call(document.querySelectorAll('#fixList .fix-title')).slice(0, 6).map(function (n) {
      return (n.firstChild ? n.firstChild.textContent : n.textContent) || '';
    });
    return {
      score: isNaN(score) ? null : score,
      domain: domEl ? domEl.textContent : '',
      grade: gradeEl ? gradeEl.textContent : '',
      fixes: fixes
    };
  }

  function setBusy(v) {
    busy = v;
    send.disabled = v;
    input.disabled = v;
  }

  async function ask(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    sugg.style.display = 'none';
    addMsg(text, 'me');
    history.push({ role: 'user', content: text });
    input.value = '';
    setBusy(true);
    var typing = el('div', { class: 'aeo-typing' }, 'Thinking...');
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    try {
      var res = await fetch(WORKER_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-8), context: scanContext() })
      });
      var data = await res.json().catch(function () { return {}; });
      typing.remove();
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      addMsg(data.reply, 'bot');
      history.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      typing.remove();
      history.pop();
      addMsg((err && err.message ? err.message : 'Could not reach the assistant.') + ' You can also email aeohelper@gmail.com.', 'err');
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  function open() {
    panel.classList.add('open');
    btn.style.display = 'none';
    if (!log.childNodes.length) {
      addMsg('Hi! I can answer questions about the audit and score, the $29 Fix Kit, payments and refunds, and AEO/SEO basics.', 'bot');
      renderSuggestions();
    }
    setTimeout(function () { input.focus(); }, 50);
  }

  function close() {
    panel.classList.remove('open');
    btn.style.display = 'flex';
    btn.focus();
  }

  // Anonymous visit count: once per browser session, no cookies, no IP stored.
  try {
    if (!sessionStorage.getItem('aeo_hit')) {
      sessionStorage.setItem('aeo_hit', '1');
      fetch(WORKER_URL + '/api/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', keepalive: true }).catch(function () {});
    }
  } catch (e) { /* storage blocked: skip */ }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
  });
})();
