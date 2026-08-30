#!/usr/bin/env python3
import json,os,socket,struct,sys,time,urllib.request,ipaddress,re
FUNCTION_URL=os.environ.get('MONITOR_FUNCTION_URL','https://tcexzfztdgximrzuosqs.supabase.co/functions/v1/network-monitor-ingest').strip()
MONITOR_KEY=os.environ.get('MONITOR_INGEST_KEY','').strip()
HOST=os.environ.get('MIKROTIK_HOST','10.200.0.2').strip()
PORT=int(os.environ.get('MIKROTIK_API_PORT','8728'))
USER=os.environ.get('MIKROTIK_USER','').strip()
PASSWORD=os.environ.get('MIKROTIK_PASSWORD','')
INTERVAL=max(30,int(os.environ.get('PPPOE_SYNC_INTERVAL_SECONDS','60')))
TIMEOUT=max(2,int(os.environ.get('MIKROTIK_TIMEOUT_SECONDS','8')))
MATCHER_VERSION='20260830-4'

def edge(body):
    data=json.dumps(body,separators=(',',':')).encode()
    req=urllib.request.Request(FUNCTION_URL,data=data,method='POST',headers={'x-monitor-key':MONITOR_KEY,'Content-Type':'application/json','Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=25) as r:
        raw=r.read(); return json.loads(raw.decode()) if raw else None

def enc_len(n):
    if n<0x80:return bytes([n])
    if n<0x4000:return struct.pack('>H',n|0x8000)
    if n<0x200000:
        v=n|0xC00000;return bytes([(v>>16)&255,(v>>8)&255,v&255])
    if n<0x10000000:return struct.pack('>I',n|0xE0000000)
    return b'\xF0'+struct.pack('>I',n)

def exact(s,n):
    b=b''
    while len(b)<n:
        c=s.recv(n-len(b))
        if not c:raise ConnectionError('MikroTik API connection closed')
        b+=c
    return b

def dec_len(s):
    a=exact(s,1)[0]
    if a<0x80:return a
    if a<0xC0:return ((a&0x3f)<<8)|exact(s,1)[0]
    if a<0xE0:
        b=exact(s,2);return ((a&0x1f)<<16)|(b[0]<<8)|b[1]
    if a<0xF0:
        b=exact(s,3);return ((a&0x0f)<<24)|(b[0]<<16)|(b[1]<<8)|b[2]
    if a==0xF0:return struct.unpack('>I',exact(s,4))[0]
    raise ValueError('Invalid RouterOS length')

def write_sentence(s,words):
    for w in words:
        b=str(w).encode();s.sendall(enc_len(len(b))+b)
    s.sendall(b'\x00')

def read_sentence(s):
    out=[]
    while True:
        n=dec_len(s)
        if n==0:return out
        out.append(exact(s,n).decode('utf-8','replace'))

def parse(words):
    d={}
    for w in words[1:]:
        if w.startswith('='):
            p=w.find('=',1)
            if p>1:d[w[1:p]]=w[p+1:]
    return d

def command(s,cmd,attrs=None):
    words=[cmd]+['='+str(k)+'='+str(v) for k,v in (attrs or {}).items()]
    write_sentence(s,words);rows=[]
    while True:
        w=read_sentence(s)
        if not w:continue
        if w[0]=='!re':rows.append(parse(w))
        elif w[0]=='!trap':raise RuntimeError(parse(w).get('message') or 'MikroTik API trap')
        elif w[0]=='!fatal':raise RuntimeError('MikroTik API fatal')
        elif w[0]=='!done':return rows

def rb(v):return str(v or '').lower() in ('true','yes','1','on')
def valid_ip(v):
    try:return str(ipaddress.ip_address(str(v or '').strip()))
    except:return None

def unique_by(rows,field,normalizer):
    temp={};dupes=set()
    for r in rows:
        k=normalizer(r.get(field))
        if not k:continue
        if k in temp:dupes.add(k)
        else:temp[k]=r
    for k in dupes:temp.pop(k,None)
    return temp

def norm_text(v):
    return re.sub(r'[^a-z0-9]','',str(v or '').lower())

def suffix_key(v):
    m=re.search(r'(\d{3,6})$',str(v or '').strip())
    if not m:return None
    return str(int(m.group(1)))

def account_candidates(account):
    a=str(account or '').strip().upper()
    if not a:return []
    out=[a,'MKTECH_'+a,'TGPH'+a]
    m=re.search(r'(\d+)$',a)
    if m:
        digits=m.group(1)
        out += [
            'SATR'+digits,
            'MKTECH_SATR'+digits,
            'TGPHSATR'+digits,
            'TGPH_SATR'+digits
        ]
    seen=[]
    for x in out:
        k=x.lower()
        if k not in seen:seen.append(k)
    return seen

def fetch_router():
    with socket.create_connection((HOST,PORT),timeout=TIMEOUT) as s:
        s.settimeout(TIMEOUT)
        command(s,'/login',{'name':USER,'password':PASSWORD})
        secrets=command(s,'/ppp/secret/print',{'.proplist':'name,disabled,profile,service,remote-address,comment'})
        active=command(s,'/ppp/active/print',{'.proplist':'name,address,uptime,service,caller-id'})
    return secrets,active

def cycle():
    targets=edge({'action':'targets'}) or []
    secrets,active=fetch_router()
    sec_name={str(r.get('name') or '').strip().lower():r for r in secrets if r.get('name')}
    act_name={str(r.get('name') or '').strip().lower():r for r in active if r.get('name')}
    sec_ip=unique_by(secrets,'remote-address',valid_ip);act_ip=unique_by(active,'address',valid_ip)
    sec_suffix=unique_by(secrets,'name',suffix_key)
    sec_comment=unique_by(secrets,'comment',norm_text)
    results=[];discovered_ip=0;discovered_name=0;discovered_suffix=0;discovered_comment=0
    for c in targets:
        account=str(c.get('account_no') or '').strip();client_name=str(c.get('client_name') or '').strip();ip=valid_ip(c.get('remote_address'));username=str(c.get('pppoe_username') or '').strip()
        if not account:continue
        secret=session=None
        if username:
            key=username.lower();secret=sec_name.get(key);session=act_name.get(key)
        if not username and ip:
            session=act_ip.get(ip);secret=sec_ip.get(ip)
            candidate=(session or secret or {}).get('name')
            if candidate:
                username=str(candidate).strip();discovered_ip+=1
                key=username.lower();secret=sec_name.get(key,secret);session=act_name.get(key,session)
        if not username:
            for key in account_candidates(account):
                if key in sec_name or key in act_name:
                    secret=sec_name.get(key);session=act_name.get(key)
                    username=str((secret or session or {}).get('name') or '').strip()
                    if username:discovered_name+=1
                    break
        if not username:
            sk=suffix_key(account)
            candidate=sec_suffix.get(sk) if sk else None
            if candidate:
                username=str(candidate.get('name') or '').strip();secret=candidate;session=act_name.get(username.lower()) if username else None
                if username:discovered_suffix+=1
        if not username and client_name:
            nk=norm_text(client_name)
            candidate=sec_comment.get(nk) if nk else None
            if candidate:
                username=str(candidate.get('name') or '').strip();secret=candidate;session=act_name.get(username.lower()) if username else None
                if username:discovered_comment+=1
        if not username:continue
        results.append({'account_no':account,'pppoe_username':username,'secret_found':secret is not None,'secret_disabled':rb((secret or {}).get('disabled')),'session_active':session is not None,'secret_remote_address':valid_ip((secret or {}).get('remote-address')),'active_address':valid_ip((session or {}).get('address')),'profile':(secret or {}).get('profile') or None,'service':(session or secret or {}).get('service') or None,'caller_id':(session or {}).get('caller-id') or None,'uptime':(session or {}).get('uptime') or None,'source':'mikrotik-api:'+HOST,'error':None})
    for i in range(0,len(results),250):edge({'action':'pppoe','results':results[i:i+250]})
    print(time.strftime('%Y-%m-%d %H:%M:%S'),f'matcher={MATCHER_VERSION} targets={len(targets)} router_secrets={len(secrets)} router_active={len(active)} matched={len(results)} unmatched={len(targets)-len(results)} discovered_by_ip={discovered_ip} discovered_by_name={discovered_name} discovered_by_suffix={discovered_suffix} discovered_by_comment={discovered_comment} pppoe_active={sum(1 for r in results if r["session_active"])}',flush=True)

def main():
    if not MONITOR_KEY:raise SystemExit('MONITOR_INGEST_KEY missing')
    if not USER or not PASSWORD:raise SystemExit('MIKROTIK_USER / MIKROTIK_PASSWORD missing')
    print(f'TechGeekPH MikroTik PPPoE Sync starting: host={HOST}:{PORT} interval={INTERVAL}s matcher={MATCHER_VERSION}',flush=True)
    while True:
        start=time.monotonic()
        try:cycle()
        except Exception as e:print(time.strftime('%Y-%m-%d %H:%M:%S'),'PPPoE sync error:',repr(e),file=sys.stderr,flush=True)
        time.sleep(max(1,INTERVAL-(time.monotonic()-start)))
if __name__=='__main__':main()
