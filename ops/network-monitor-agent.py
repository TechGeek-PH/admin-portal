#!/usr/bin/env python3
import concurrent.futures
import ipaddress
import json
import os
import re
import socket
import struct
import subprocess
import sys
import time
import urllib.request

FUNCTION_URL=os.environ.get('MONITOR_FUNCTION_URL','https://tcexzfztdgximrzuosqs.supabase.co/functions/v1/network-monitor-ingest').strip()
MONITOR_KEY=os.environ.get('MONITOR_INGEST_KEY','').strip()
PING_INTERFACE=os.environ.get('PING_INTERFACE','wg0').strip()
INTERVAL=max(20,int(os.environ.get('MONITOR_INTERVAL_SECONDS','60')))
TIMEOUT=max(1,int(os.environ.get('PING_TIMEOUT_SECONDS','1')))
WORKERS=max(1,min(100,int(os.environ.get('PING_WORKERS','40'))))
SOURCE=os.environ.get('MONITOR_SOURCE','digitalocean-wireguard').strip() or 'digitalocean-wireguard'
MIKROTIK_HOST=os.environ.get('MIKROTIK_HOST','').strip()
MIKROTIK_PORT=int(os.environ.get('MIKROTIK_API_PORT','8728'))
MIKROTIK_USER=os.environ.get('MIKROTIK_USER','').strip()
MIKROTIK_PASSWORD=os.environ.get('MIKROTIK_PASSWORD','')
MIKROTIK_TIMEOUT=max(2,int(os.environ.get('MIKROTIK_TIMEOUT_SECONDS','8')))
TIME_RE=re.compile(r'time[=<]([0-9.]+)\s*ms',re.I)


def edge(body):
    if not MONITOR_KEY:
        raise RuntimeError('MONITOR_INGEST_KEY is missing')
    data=json.dumps(body,separators=(',',':')).encode()
    req=urllib.request.Request(
        FUNCTION_URL,
        data=data,
        method='POST',
        headers={
            'x-monitor-key':MONITOR_KEY,
            'Content-Type':'application/json',
            'Accept':'application/json'
        }
    )
    with urllib.request.urlopen(req,timeout=25) as resp:
        raw=resp.read()
        return json.loads(raw.decode()) if raw else None


def is_intentionally_disconnected(row):
    text=(' '.join([str(row.get('account_status') or ''),str(row.get('service_status') or '')])).lower()
    return any(x in text for x in ('disconnect','suspend','expired','inactive','terminated','closed'))


def valid_target(value):
    value=str(value or '').strip()
    if not value:
        return None
    try:
        ipaddress.ip_address(value)
        return value
    except ValueError:
        return None


def ping_one(row):
    account=str(row.get('account_no') or '').strip()
    target=valid_target(row.get('remote_address'))
    if not account or not target or is_intentionally_disconnected(row):
        return None
    cmd=['ping','-n','-c','1','-W',str(TIMEOUT)]
    if PING_INTERFACE:
        cmd += ['-I',PING_INTERFACE]
    cmd.append(target)
    started=time.monotonic()
    try:
        p=subprocess.run(cmd,capture_output=True,text=True,timeout=TIMEOUT+2)
        output=(p.stdout or '')+'\n'+(p.stderr or '')
        reachable=p.returncode==0
        latency=None
        if reachable:
            m=TIME_RE.search(output)
            latency=round(float(m.group(1)),2) if m else round((time.monotonic()-started)*1000,2)
        err=None if reachable else (output.strip().splitlines()[-1][:240] if output.strip() else 'No ping reply')
        return {'account_no':account,'target_ip':target,'reachable':reachable,'latency_ms':latency,'source':SOURCE,'error':err}
    except subprocess.TimeoutExpired:
        return {'account_no':account,'target_ip':target,'reachable':False,'latency_ms':None,'source':SOURCE,'error':'Ping timeout'}
    except Exception as e:
        return {'account_no':account,'target_ip':target,'reachable':False,'latency_ms':None,'source':SOURCE,'error':str(e)[:240]}


def fetch_clients():
    rows=edge({'action':'targets'})
    return rows if isinstance(rows,list) else []


def submit_ping(results):
    for i in range(0,len(results),100):
        batch=results[i:i+100]
        if batch:
            edge({'action':'ingest','results':batch})


def submit_pppoe(results):
    for i in range(0,len(results),250):
        batch=results[i:i+250]
        if batch:
            edge({'action':'pppoe','results':batch})


# Minimal RouterOS API client (TCP 8728). The transport stays inside WireGuard.
def ros_len_encode(length):
    if length < 0x80:
        return bytes([length])
    if length < 0x4000:
        return struct.pack('>H', length | 0x8000)
    if length < 0x200000:
        value=length | 0xC00000
        return bytes([(value >> 16) & 0xff,(value >> 8) & 0xff,value & 0xff])
    if length < 0x10000000:
        value=length | 0xE0000000
        return struct.pack('>I',value)
    return b'\xF0'+struct.pack('>I',length)


def ros_read_exact(sock,n):
    buf=b''
    while len(buf)<n:
        chunk=sock.recv(n-len(buf))
        if not chunk:
            raise ConnectionError('MikroTik API connection closed')
        buf+=chunk
    return buf


def ros_len_decode(sock):
    first=ros_read_exact(sock,1)[0]
    if first < 0x80:
        return first
    if first < 0xC0:
        return ((first & 0x3f) << 8) | ros_read_exact(sock,1)[0]
    if first < 0xE0:
        b=ros_read_exact(sock,2)
        return ((first & 0x1f) << 16) | (b[0] << 8) | b[1]
    if first < 0xF0:
        b=ros_read_exact(sock,3)
        return ((first & 0x0f) << 24) | (b[0] << 16) | (b[1] << 8) | b[2]
    if first == 0xF0:
        return struct.unpack('>I',ros_read_exact(sock,4))[0]
    raise ValueError('Unsupported RouterOS API length prefix')


def ros_write_sentence(sock,words):
    for word in words:
        data=str(word).encode('utf-8')
        sock.sendall(ros_len_encode(len(data))+data)
    sock.sendall(b'\x00')


def ros_read_sentence(sock):
    words=[]
    while True:
        n=ros_len_decode(sock)
        if n==0:
            return words
        words.append(ros_read_exact(sock,n).decode('utf-8','replace'))


def ros_parse_record(words):
    out={}
    for word in words[1:]:
        if word.startswith('='):
            p=word.find('=',1)
            if p>1:
                out[word[1:p]]=word[p+1:]
    return out


def ros_command(sock,command,attrs=None):
    words=[command]
    for k,v in (attrs or {}).items():
        words.append('='+str(k)+'='+str(v))
    ros_write_sentence(sock,words)
    rows=[]
    while True:
        sentence=ros_read_sentence(sock)
        if not sentence:
            continue
        kind=sentence[0]
        if kind=='!re':
            rows.append(ros_parse_record(sentence))
        elif kind=='!trap':
            record=ros_parse_record(sentence)
            raise RuntimeError(record.get('message') or 'MikroTik API trap')
        elif kind=='!fatal':
            raise RuntimeError('MikroTik API fatal response')
        elif kind=='!done':
            return rows


def ros_bool(value):
    return str(value or '').strip().lower() in ('true','yes','1','on')


def fetch_mikrotik_pppoe(clients):
    if not (MIKROTIK_HOST and MIKROTIK_USER and MIKROTIK_PASSWORD):
        return [],'not-configured'
    with socket.create_connection((MIKROTIK_HOST,MIKROTIK_PORT),timeout=MIKROTIK_TIMEOUT) as sock:
        sock.settimeout(MIKROTIK_TIMEOUT)
        ros_command(sock,'/login',{'name':MIKROTIK_USER,'password':MIKROTIK_PASSWORD})
        secrets=ros_command(sock,'/ppp/secret/print',{'.proplist':'name,disabled,profile,service,remote-address'})
        active=ros_command(sock,'/ppp/active/print',{'.proplist':'name,address,uptime,service,caller-id'})

    secret_map={str(x.get('name') or '').strip().lower():x for x in secrets if x.get('name')}
    active_map={str(x.get('name') or '').strip().lower():x for x in active if x.get('name')}
    results=[]
    for c in clients:
        account=str(c.get('account_no') or '').strip()
        username=str(c.get('pppoe_username') or '').strip()
        if not account or not username:
            continue
        key=username.lower()
        secret=secret_map.get(key)
        session=active_map.get(key)
        results.append({
            'account_no':account,
            'pppoe_username':username,
            'secret_found':secret is not None,
            'secret_disabled':ros_bool(secret.get('disabled')) if secret else False,
            'session_active':session is not None,
            'active_address':(session or {}).get('address') or None,
            'profile':(secret or {}).get('profile') or None,
            'service':(session or secret or {}).get('service') or None,
            'caller_id':(session or {}).get('caller-id') or None,
            'uptime':(session or {}).get('uptime') or None,
            'source':'mikrotik-api:'+MIKROTIK_HOST,
            'error':None
        })
    return results,{'secrets':len(secrets),'active_sessions':len(active)}


def cycle():
    clients=fetch_clients()
    eligible=[c for c in clients if valid_target(c.get('remote_address')) and not is_intentionally_disconnected(c)]
    ping_results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures=[pool.submit(ping_one,c) for c in eligible]
        for f in concurrent.futures.as_completed(futures):
            r=f.result()
            if r:
                ping_results.append(r)
    submit_ping(ping_results)
    online=sum(1 for r in ping_results if r['reachable'])

    pppoe_count=0
    pppoe_active=0
    pppoe_note='disabled'
    if MIKROTIK_HOST and MIKROTIK_USER and MIKROTIK_PASSWORD:
        try:
            pppoe_results,info=fetch_mikrotik_pppoe(clients)
            if pppoe_results:
                submit_pppoe(pppoe_results)
            pppoe_count=len(pppoe_results)
            pppoe_active=sum(1 for r in pppoe_results if r['session_active'])
            pppoe_note=f"router_active={info.get('active_sessions',0)} router_secrets={info.get('secrets',0)}"
        except Exception as e:
            pppoe_note='ERROR '+str(e)[:180]

    print(time.strftime('%Y-%m-%d %H:%M:%S'),
          f'targets={len(clients)} checked={len(ping_results)} online={online} down={len(ping_results)-online} '
          f'pppoe_checked={pppoe_count} pppoe_active={pppoe_active} {pppoe_note}',flush=True)


def main():
    mt='enabled '+MIKROTIK_HOST if (MIKROTIK_HOST and MIKROTIK_USER and MIKROTIK_PASSWORD) else 'not configured'
    print(f'TechGeekPH Network Monitor starting: interval={INTERVAL}s interface={PING_INTERFACE or "route-default"} workers={WORKERS} mikrotik={mt}',flush=True)
    while True:
        started=time.monotonic()
        try:
            cycle()
        except Exception as e:
            print(time.strftime('%Y-%m-%d %H:%M:%S'),'cycle error:',repr(e),file=sys.stderr,flush=True)
        elapsed=time.monotonic()-started
        time.sleep(max(1,INTERVAL-elapsed))


if __name__=='__main__':
    main()
