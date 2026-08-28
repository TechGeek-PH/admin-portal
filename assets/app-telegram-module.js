(function(){
  'use strict';

  function role(){
    var el=document.getElementById('topRole');
    return String(el&&el.textContent||'').trim().toUpperCase();
  }

  function addTile(box){
    if(!box||box.querySelector('[data-telegram-settings-tile]'))return;
    var a=document.createElement('a');
    a.className='tile';
    a.href='telegram-settings.html';
    a.dataset.title='Telegram Settings';
    a.dataset.telegramSettingsTile='1';
    a.innerHTML='<span class="ico">✈</span><b>Telegram Settings</b><small>Bot token and admin receiver</small>';
    box.appendChild(a);
  }

  function sync(){
    var r=role();
    if(r!=='OWNER'&&r!=='ADMIN')return;
    addTile(document.getElementById('menu'));
    addTile(document.getElementById('allModules'));
    var all=document.getElementById('allModules');
    var hint=document.getElementById('moduleHint');
    if(all&&hint)hint.textContent=all.querySelectorAll('a.tile').length+' modules';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});
  else sync();
  setTimeout(sync,250);
  setTimeout(sync,900);
  setTimeout(sync,1800);
  window.addEventListener('storage',sync);
})();
