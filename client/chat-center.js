(()=>{
'use strict';
if(window.__tgClientChatCenter)return;window.__tgClientChatCenter=true;
const TOKEN_KEY='tg_client_portal_token';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>{if(!v)return'';try{return new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v))}catch(_){return String(v)}};
function init(){
  const db=window.TechGeekSupabase,nav=document.querySelector('.nav'),wrap=document.querySelector('.wrap');
  if(!db||!nav||!wrap){setTimeout(init,180);return}
  if(document.getElementById('chatPane'))return;
  const style=document.createElement('style');
  style.textContent=`
  .nav{grid-template-columns:repeat(6,1fr)!important}.tg-chat-nav{position:relative}.tg-chat-badge{display:none;position:absolute;top:7px;left:calc(50% + 10px);min-width:17px;height:17px;padding:0 5px;border-radius:999px;background:#b42345;color:#fff;font-size:.52rem;line-height:17px;text-align:center}.tg-chat-badge.show{display:block}
  .tg-chat-shell{overflow:hidden;padding:0!important}.tg-chat-head{padding:14px 15px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#f8fbff,#f5f0fb)}.tg-chat-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.tg-chat-title h2{margin:0}.tg-chat-online{display:inline-flex;align-items:center;gap:5px;color:var(--ok);font-size:.62rem;font-weight:900}.tg-chat-online:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--ok)}.tg-chat-account{margin-top:6px;color:var(--b);font-size:.72rem;font-weight:900}
  .tg-chat-messages{min-height:300px;max-height:520px;overflow:auto;padding:14px;background:#f5f7fa;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}.tg-chat-empty{margin:auto;text-align:center;color:var(--m);font-size:.72rem;line-height:1.55;padding:30px 14px}.tg-msg{max-width:86%;display:grid;gap:3px}.tg-msg.client{align-self:flex-end}.tg-msg.staff,.tg-msg.system{align-self:flex-start}.tg-msg-meta{font-size:.56rem;color:var(--m);padding:0 3px}.tg-msg.client .tg-msg-meta{text-align:right}.tg-msg-bubble{padding:10px 12px;border-radius:15px;font-size:.76rem;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.tg-msg.client .tg-msg-bubble{background:var(--b);color:#fff;border-bottom-right-radius:5px}.tg-msg.staff .tg-msg-bubble{background:#fff;border:1px solid var(--line);color:var(--ink);border-bottom-left-radius:5px}.tg-msg.system .tg-msg-bubble{background:#fff7e8;border:1px solid #f1dfb6;color:#77500d}
  .tg-chat-compose{padding:11px;border-top:1px solid var(--line);background:#fff}.tg-chat-compose textarea{width:100%;min-height:78px;max-height:160px;resize:vertical;border:1px solid var(--line);border-radius:12px;padding:10px 11px;font-size:16px;outline:none}.tg-chat-compose textarea:focus{border-color:#7eb2d8;box-shadow:0 0 0 3px #064f8312}.tg-chat-actions{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:8px}.tg-chat-hint{color:var(--m);font-size:.58rem;line-height:1.35}.tg-chat-send{border:0;border-radius:11px;min-height:43px;padding:0 18px;background:var(--b);color:#fff;font-weight:900}.tg-chat-send:disabled{opacity:.55}.tg-chat-error{display:none;margin:10px 14px 0;padding:9px 10px;border-radius:9px;background:#fff0f2;color:#a3153d;font-size:.66rem}.tg-chat-error.show{display:block}
  @media(max-width:520px){.nav button{font-size:.53rem}.tg-msg{max-width:92%}.tg-chat-hint{max-width:60%}}
  `;
  document.head.appendChild(style);
  const supportBtn=[...nav.querySelectorAll('button')].find(b=>b.dataset.pane==='supportPane');
  const btn=document.createElement('button');btn.type='button';btn.dataset.pane='chatPane';btn.className='tg-chat-nav';btn.innerHTML='Chat<span id="tgChatBadge" class="tg-chat-badge"></span>';
  if(supportBtn)nav.insertBefore(btn,supportBtn);else nav.appendChild(btn);
  const pane=document.createElement('section');pane.id='chatPane';pane.className='pane';pane.innerHTML=`<section class="section tg-chat-shell"><div class="tg-chat-head"><div class="tg-chat-title"><h2>Chat Center</h2><span class="tg-chat-online">Support Online</span></div><div class="tg-chat-account" id="tgChatAccount">Your account</div></div><div id="tgChatError" class="tg-chat-error"></div><div id="tgChatMessages" class="tg-chat-messages"><div class="tg-chat-empty">Loading your conversation…</div></div><div class="tg-chat-compose"><textarea id="tgChatText" maxlength="1500" placeholder="Type your message here..."></textarea><div class="tg-chat-actions"><div class="tg-chat-hint">Support replies appear here automatically.</div><button type="button" id="tgChatSend" class="tg-chat-send">Send Message</button></div></div></section>`;
  const supportPane=document.getElementById('supportPane');if(supportPane)wrap.insertBefore(pane,supportPane);else wrap.appendChild(pane);
  const $=id=>document.getElementById(id),messages=$('tgChatMessages'),badge=$('tgChatBadge'),errorBox=$('tgChatError');
  let busy=false,lastSignature='';
  function token(){return localStorage.getItem(TOKEN_KEY)||''}
  function chatActive(){return pane.classList.contains('active')&&!document.getElementById('appView')?.classList.contains('hidden')}
  function showError(t=''){errorBox.textContent=t;errorBox.classList.toggle('show',!!t)}
  function setUnread(n){n=Number(n||0);badge.textContent=n>99?'99+':String(n);badge.classList.toggle('show',n>0)}
  function render(r){
    $('tgChatAccount').textContent=(r.client_name||'Client')+' · '+(r.account_no||'Account');setUnread(r.unread||0);
    const rows=Array.isArray(r.messages)?r.messages:[];
    const sig=rows.map(x=>x.id+':'+x.sender_type+':'+x.message_body).join('|');if(sig===lastSignature)return;lastSignature=sig;
    if(!rows.length){messages.innerHTML='<div class="tg-chat-empty"><b>No messages yet.</b><br>Send a message to TechGeekPH Support.</div>';return}
    messages.innerHTML=rows.map(x=>{const type=String(x.sender_type||'SYSTEM').toLowerCase(),who=x.sender_type==='CLIENT'?'You':(x.sender_name||'TechGeekPH Support');return `<div class="tg-msg ${esc(type)}"><div class="tg-msg-meta">${esc(who)} · ${esc(fmt(x.created_at))}</div><div class="tg-msg-bubble">${esc(x.message_body)}</div></div>`}).join('');
    messages.scrollTop=messages.scrollHeight;
  }
  async function loadChat(mark=false){
    if(!token())return;
    try{const {data:r,error}=await db.rpc('client_chat_get',{p_token:token()});if(error)throw error;if(!r?.ok){if(r?.code==='SESSION_INVALID')return;throw new Error(r?.message||'Unable to load chat.')}render(r);showError('');if(mark&&Number(r.unread||0)>0){await db.rpc('client_chat_mark_read',{p_token:token()});setUnread(0)}}catch(e){if(chatActive())showError(e?.message||'Unable to load chat right now.')}
  }
  async function send(){
    if(busy)return;const text=$('tgChatText').value.trim();if(!text)return showError('Type your message first.');if(!token())return showError('Please sign in again.');
    busy=true;$('tgChatSend').disabled=true;$('tgChatSend').textContent='Sending…';showError('');
    try{const {data:r,error}=await db.functions.invoke('client-chat-send',{body:{token:token(),message:text}});if(error)throw error;if(!r?.ok)throw new Error(r?.message||'Unable to send message.');$('tgChatText').value='';await loadChat(true)}catch(e){showError(e?.message||'Unable to send message right now.')}finally{busy=false;$('tgChatSend').disabled=false;$('tgChatSend').textContent='Send Message'}
  }
  btn.addEventListener('click',()=>{nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===btn));document.querySelectorAll('.pane').forEach(x=>x.classList.toggle('active',x===pane));loadChat(true)});
  $('tgChatSend').addEventListener('click',send);$('tgChatText').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadChat(chatActive())});
  setInterval(()=>{if(token()&&!document.hidden)loadChat(chatActive())},2000);
  setTimeout(()=>loadChat(false),300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
