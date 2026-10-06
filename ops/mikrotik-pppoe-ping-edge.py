#!/usr/bin/env python3
import concurrent.futures, ipaddress, json, os, re, statistics, sys, time
import requests, routeros_api

VERSION="20261006-edge-v1"
FUNCTION_URL=os.environ.get("MONITOR_FUNCTION_URL","https://tcexzfztdgximrzuosqs.supabase.co/functions/v1/network-monitor-ingest").strip()
MONITOR_KEY=os.environ.get("MONITOR_INGEST_KEY","").strip()
HOST=os.environ.get("MIKROTIK_HOST","10.200.0.2").strip()
PORT=int(os.environ.get("MIKROTIK_API_PORT","8728"))
USER=os.environ.get("MIKROTIK_USER","").strip()
PASSWORD=os.environ.get("MIKROTIK_PASSWORD","")
INTERVAL=max(30,int(os.environ.get("PPPOE_PING_MONITOR_INTERVAL_SECONDS","60")))
PING_COUNT=max(2,min(5,int(os.environ.get("PPPOE_PING_COUNT","3"))))
WORKERS=max(1,min(6,int(os.environ.get("PPPOE_PING_WORKERS","4"))))
SOURCE="mikrotik-pppoe-ping:"+HOST

def edge(body):
    r=requests.post(FUNCTION_URL,headers={"x-monitor-key":MONITOR_KEY,"content-type":"application/json"},json=body,timeout=30)
    if not r.ok: raise RuntimeError("monitor edge %s: %s"%(r.status_code,r.text[:300]))
    return r.json() if r.text.strip() else None

def pool():
    return routeros_api.RouterOsApiPool(HOST,username=USER,password=PASSWORD,port=PORT,plaintext_login=True)

def ip(v):
    try:return str(ipaddress.ip_address(str(v or "").strip()))
    except:return None

def suffix(v):
    m=re.search(r"(\d{3,6})$",str(v or "").strip())
    return str(int(m.group(1))) if m else None

def candidates(account):
    a=str(account or "").strip().upper()
    out=[a,"MKTECH_"+a,"TGPH"+a,"TGPH_"+a] if a else []
    m=re.search(r"(\d+)$",a)
    if m:
        d=m.group(1);out += ["SATR"+d,"MKTECH_SATR"+d,"TGPHSATR"+d,"TGPH_SATR"+d]
    return list(dict.fromkeys(x.lower() for x in out if x))

def ms(v):
    s=str(v or "").strip().lower()
    m=re.fullmatch(r"([0-9.]+)\s*(ns|us|µs|ms|s)",s)
    if not m:return None
    n=float(m.group(1));u=m.group(2)
    if u=="ns":return n/1000000
    if u in ("us","µs"):return n/1000
    if u=="ms":return n
    return n*1000

def snapshot():
    p=pool()
    try:
        api=p.get_api()
        return list(api.get_resource("/ppp/active").get()),list(api.get_resource("/ppp/secret").get())
    finally:p.disconnect()

def ping_chunk(jobs):
    if not jobs:return []
    p=pool();out=[]
    try:
        ping=p.get_api().get_resource("/ping")
        for account,target in jobs:
            try:
                rows=ping.call(address=target,count=str(PING_COUNT),interval="100ms")
                samples=[ms(x.get("time")) for x in rows if isinstance(x,dict)]
                samples=[round(float(x),3) for x in samples if x is not None]
                ok=bool(samples)
                latency=round(float(statistics.median(samples)),2) if samples else None
                out.append({"account_no":account,"target_ip":target,"reachable":ok,"latency_ms":latency,
                            "ping_samples":samples,"packet_loss":round((PING_COUNT-len(samples))*100.0/PING_COUNT,1),
                            "source":SOURCE,"error":None if ok else "No ping reply from active PPPoE client"})
            except Exception as e:
                out.append({"account_no":account,"target_ip":target,"reachable":None,"source":SOURCE,
                            "error":"Router ping error: %s: %s"%(type(e).__name__,e),"_err":True})
        return out
    finally:p.disconnect()

def cycle():
    targets=edge({"action":"targets"}) or []
    active,secrets=snapshot()
    an={str(x.get("name") or "").strip().lower():x for x in active if x.get("name")}
    sn={str(x.get("name") or "").strip().lower():x for x in secrets if x.get("name")}
    ai={};si={}
    for x in active:
        v=ip(x.get("address"))
        if v and v not in ai:ai[v]=x
    for x in secrets:
        v=ip(x.get("remote-address"))
        if v and v not in si:si[v]=x
    ss={};dup=set()
    for x in secrets:
        k=suffix(x.get("name"))
        if not k:continue
        if k in ss:dup.add(k)
        else:ss[k]=x
    for k in dup:ss.pop(k,None)

    jobs=[];down=[];matched=0
    for c in targets:
        account=str(c.get("account_no") or "").strip()
        if not account:continue
        remote=ip(c.get("remote_address"))
        username=str(c.get("pppoe_username") or "").strip()
        session=an.get(username.lower()) if username else None
        secret=sn.get(username.lower()) if username else None
        if not username and remote:
            session=ai.get(remote);secret=si.get(remote)
            username=str((session or secret or {}).get("name") or "").strip()
        if not username:
            for k in candidates(account):
                if k in an or k in sn:
                    session=an.get(k);secret=sn.get(k)
                    username=str((session or secret or {}).get("name") or "").strip();break
        if not username:
            k=suffix(account);secret=ss.get(k) if k else None
            if secret:
                username=str(secret.get("name") or "").strip();session=an.get(username.lower())
        if not username:continue
        matched+=1
        addr=ip((session or {}).get("address"))
        if session is not None and addr:jobs.append((account,addr))
        else:down.append({"account_no":account,"target_ip":ip((secret or {}).get("remote-address")) or remote,
                          "reachable":False,"latency_ms":None,"ping_samples":[],"packet_loss":100.0,
                          "source":SOURCE,"error":"PPPoE session inactive"})

    chunks=[[] for _ in range(WORKERS)]
    for i,j in enumerate(jobs):chunks[i%WORKERS].append(j)
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for f in concurrent.futures.as_completed([ex.submit(ping_chunk,c) for c in chunks if c]):
            results.extend(f.result())
    errors=sum(1 for x in results if x.pop("_err",False))
    ingest=down+[x for x in results if x.get("reachable") is not None]
    for i in range(0,len(ingest),100):edge({"action":"ingest","results":ingest[i:i+100]})
    online=sum(1 for x in ingest if x.get("reachable") is True)
    offline=sum(1 for x in ingest if x.get("reachable") is False)
    print(time.strftime("%Y-%m-%d %H:%M:%S"),
          "version=%s targets=%d router_active=%d matched=%d ping_jobs=%d ping_online=%d ping_down=%d ping_errors=%d"%
          (VERSION,len(targets),len(active),matched,len(jobs),online,offline,errors),flush=True)

def main():
    if not MONITOR_KEY or not USER or not PASSWORD:
        raise SystemExit("Missing MONITOR_INGEST_KEY / MIKROTIK_USER / MIKROTIK_PASSWORD")
    print("TechGeekPH PPPoE edge ping starting version=%s router=%s:%d"%(VERSION,HOST,PORT),flush=True)
    while True:
        started=time.monotonic()
        try:cycle()
        except Exception as e:print(time.strftime("%Y-%m-%d %H:%M:%S"),"cycle error:",repr(e),file=sys.stderr,flush=True)
        time.sleep(max(1,INTERVAL-(time.monotonic()-started)))

if __name__=="__main__":main()
