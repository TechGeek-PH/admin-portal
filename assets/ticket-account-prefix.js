(function(){
  'use strict';
  if(!/(^|\/)app-tickets\.html$/i.test(window.location.pathname))return;

  const PRESETS=['SATR','SLRP','KRPP','WBRD','WBRP'];
  let syncTimer=null;

  function ticketNo(){
    const t=document.getElementById('dlgTitle');
    return t?String(t.textContent||'').split('·')[0].trim():'';
  }
  function storeKey(){
    const no=ticketNo();
    return no?'tg_install_account_prefix_'+no:'';
  }
  function normalizePrefix(v){return String(v||'').trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,8)}
  function parseAccount(v){
    const m=String(v||'').trim().match(/^([A-Za-z]+)([0-9]+)$/);
    return m?{prefix:m[1].toUpperCase(),number:m[2]}:null;
  }

  function setup(){
    const hidden=document.getElementById('cuAccount');
    const db=window.TechGeekSupabase;
    if(!hidden||!db){setTimeout(setup,120);return}
    if(hidden.dataset.prefixEnhanced==='1')return;
    hidden.dataset.prefixEnhanced='1';

    const field=hidden.closest('.field');
    if(!field)return;
    const label=field.querySelector('label');
    if(label)label.textContent='Account Prefix / Number';

    hidden.type='hidden';
    hidden.style.display='none';

    const wrap=document.createElement('div');
    wrap.style.cssText='display:grid;grid-template-columns:minmax(118px,.8fr) minmax(150px,1.2fr);gap:8px;align-items:start';

    const left=document.createElement('div');
    const prefix=document.createElement('select');
    prefix.id='cuAccountPrefix';
    prefix.innerHTML='<option value="SATR">SATR</option><option value="SLRP">SLRP</option><option value="KRPP">KRPP</option><option value="WBRD">WBRD</option><option value="WBRP">WBRP</option><option value="CUSTOM">Custom</option>';
    prefix.style.width='100%';

    const custom=document.createElement('input');
    custom.id='cuAccountPrefixCustom';
    custom.placeholder='Custom prefix';
    custom.maxLength=8;
    custom.autocapitalize='characters';
    custom.style.cssText='width:100%;margin-top:6px;display:none;text-transform:uppercase';

    const number=document.createElement('input');
    number.id='cuAccountNumber';
    number.readOnly=true;
    number.placeholder='AUTO — next number';
    number.style.width='100%';

    left.appendChild(prefix);
    left.appendChild(custom);
    wrap.appendChild(left);
    wrap.appendChild(number);
    field.appendChild(wrap);

    const hint=document.createElement('div');
    hint.className='hint';
    hint.textContent='Select the account prefix. Only the number is generated automatically using the next installation number.';
    field.appendChild(hint);

    function selectedPrefix(){
      if(prefix.value==='CUSTOM'){
        const v=normalizePrefix(custom.value);
        if(v.length<2)throw new Error('Custom account prefix must contain 2-8 letters.');
        return v;
      }
      return prefix.value;
    }

    function saveChoice(){
      const k=storeKey();
      if(!k)return;
      try{localStorage.setItem(k,JSON.stringify({mode:prefix.value,custom:normalizePrefix(custom.value)}))}catch(_){}
    }
    function loadChoice(){
      const k=storeKey();
      if(!k)return;
      try{
        const d=JSON.parse(localStorage.getItem(k)||'null');
        if(!d)return;
        prefix.value=PRESETS.includes(d.mode)?d.mode:(d.mode==='CUSTOM'?'CUSTOM':'SATR');
        custom.value=normalizePrefix(d.custom||'');
      }catch(_){}
    }
    function showCustom(){custom.style.display=prefix.value==='CUSTOM'?'block':'none'}

    prefix.addEventListener('change',()=>{showCustom();saveChoice()});
    custom.addEventListener('input',()=>{custom.value=normalizePrefix(custom.value);saveChoice()});

    function sync(){
      const parsed=parseAccount(hidden.value);
      if(parsed){
        if(PRESETS.includes(parsed.prefix)){
          prefix.value=parsed.prefix;
          custom.value='';
        }else{
          prefix.value='CUSTOM';
          custom.value=parsed.prefix;
        }
        number.value=parsed.number;
        prefix.disabled=true;
        custom.disabled=true;
        showCustom();
        const k=storeKey();
        if(k){try{localStorage.removeItem(k)}catch(_){}}
      }else{
        if(prefix.disabled){prefix.disabled=false;custom.disabled=false}
        number.value='';
        loadChoice();
        showCustom();
      }
    }

    if(!db.__tgAccountPrefixRpcPatched){
      const originalRpc=db.rpc.bind(db);
      db.rpc=function(fn,args,opts){
        if(fn==='save_new_install_wizard_details'&&args&&args.p_client_details){
          const current=document.getElementById('cuAccount');
          const parsed=parseAccount(current&&current.value);
          if(!parsed){
            const p=document.getElementById('cuAccountPrefix');
            const c=document.getElementById('cuAccountPrefixCustom');
            let chosen=p?p.value:'SATR';
            if(chosen==='CUSTOM'){
              chosen=normalizePrefix(c&&c.value);
              if(chosen.length<2)throw new Error('Custom account prefix must contain 2-8 letters.');
            }
            args=Object.assign({},args,{p_client_details:Object.assign({},args.p_client_details,{account_prefix:chosen})});
          }
        }
        return originalRpc(fn,args,opts);
      };
      db.__tgAccountPrefixRpcPatched=true;
    }

    sync();
    if(syncTimer)clearInterval(syncTimer);
    syncTimer=setInterval(sync,300);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
