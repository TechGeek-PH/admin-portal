#!/usr/bin/env python3
import concurrent.futures
import ipaddress
import json
import os
import re
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


def submit(results):
    for i in range(0,len(results),100):
        batch=results[i:i+100]
        if batch:
            edge({'action':'ingest','results':batch})


def cycle():
    clients=fetch_clients()
    eligible=[c for c in clients if valid_target(c.get('remote_address')) and not is_intentionally_disconnected(c)]
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures=[pool.submit(ping_one,c) for c in eligible]
        for f in concurrent.futures.as_completed(futures):
            r=f.result()
            if r:
                results.append(r)
    submit(results)
    online=sum(1 for r in results if r['reachable'])
    print(time.strftime('%Y-%m-%d %H:%M:%S'),f'targets={len(clients)} checked={len(results)} online={online} down={len(results)-online}',flush=True)


def main():
    print(f'TechGeekPH Network Monitor starting: interval={INTERVAL}s interface={PING_INTERFACE or "route-default"} workers={WORKERS}',flush=True)
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
