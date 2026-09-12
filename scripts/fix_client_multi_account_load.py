from pathlib import Path
p=Path('client/app.js')
s=p.read_text()
s=s.replace("paymentReminder();loadAccounts(false);if(!profileOriginal&&!profileLoading)loadProfile(false);if(!profileOriginal&&!profileLoading)loadProfile(false)","paymentReminder();loadAccounts(false);if(!profileOriginal&&!profileLoading)loadProfile(false)")
p.write_text(s)
print('Client load flow normalized.')
