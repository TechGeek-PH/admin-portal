from pathlib import Path
import re
p=Path('client/app.js')
s=p.read_text()
profile_call=r"if\(!profileOriginal&&!profileLoading\)loadProfile\(false\);?"
load_call=r"loadAccounts\(false\);?"
pattern=r"paymentReminder\(\);(?:(?:"+profile_call+r")|(?:"+load_call+r"))+"
s,n=re.subn(pattern,"paymentReminder();loadAccounts(false);if(!profileOriginal&&!profileLoading)loadProfile(false)",s,count=1)
if n==0:
    s=s.replace("paymentReminder();if(!profileOriginal&&!profileLoading)loadProfile(false)","paymentReminder();loadAccounts(false);if(!profileOriginal&&!profileLoading)loadProfile(false)",1)
p.write_text(s)
print('Client load flow fully normalized.')
