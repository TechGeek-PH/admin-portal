(function(){'use strict';
const categories={
'Internet / ISP':['No Internet Connection','Intermittent Connection','Slow Internet','High Latency / High Ping','Packet Loss','Wi-Fi Connection Issue','Weak Wi-Fi Signal','Router Configuration','Router Replacement','Modem / ONU Issue','PPPoE Configuration','IP Address Configuration','Static IP Request','DNS Issue','LAN / Ethernet Issue','Network Cable Replacement','Network Port Issue','Access Point Installation','Network Expansion','Network Maintenance','Internet Installation','Internet Relocation / Transfer','Internet Upgrade / Downgrade','Internet Disconnection / Termination','Fiber Line Issue','Fiber Cut / Damaged Cable','LOS / Red LOS','NAP Box / Port Issue','OLT / ONU Connectivity Issue'],
'Network / Wi-Fi':['Wi-Fi Installation','Wi-Fi Configuration','Weak Wi-Fi Signal','Wi-Fi Dead Spot','Wi-Fi Extender Installation','Mesh Wi-Fi Installation','Access Point Installation','Access Point Configuration','Wi-Fi Password Change','Guest Wi-Fi Setup','Wireless Bridge Setup','Point-to-Point Wireless Setup'],
'CCTV':['CCTV Installation','CCTV Camera Replacement','CCTV Camera Relocation','No Camera Display','Camera Offline','Blurry Camera','No Night Vision','Camera Color / Image Issue','CCTV Cable Issue','CCTV Power Supply Issue','DVR Issue','NVR Issue','DVR / NVR Replacement','Hard Drive / Storage Issue','No Recording','Recording Playback Issue','CCTV Remote Viewing Setup','CCTV Mobile App Setup','CCTV Remote Viewing Issue','CCTV Password Reset','CCTV Network Configuration','CCTV Preventive Maintenance','CCTV System Upgrade','Additional Camera Installation'],
'Computer / Laptop':["Computer Won't Turn On",'No Display','Slow Computer','Computer Freezing / Hanging','Automatic Restart','Blue Screen / BSOD','Windows Error','Windows Installation / Reinstallation','Windows Activation','Driver Installation','Software Installation','Software Error','Virus / Malware Removal','Computer Cleanup / Optimization','RAM Upgrade','SSD / HDD Upgrade','Storage Replacement','Power Supply Replacement','Motherboard Issue','GPU / Graphics Issue','CPU / Overheating Issue','Laptop Battery Issue','Laptop Charger Issue','Keyboard Issue','Touchpad Issue','LCD / Monitor Issue','Data Backup','Data Recovery','Computer Preventive Maintenance'],
'Printer / Scanner':['Printer Installation','Printer Configuration','Printer Not Printing','Printer Offline','Paper Jam','Poor Print Quality','Ink / Toner Issue','Network Printer Issue','Printer Sharing Setup','Scanner Issue','Scanner Setup','Printer Preventive Maintenance'],
'Server / NAS':['Server Installation','Server Configuration','Server Offline','Server Performance Issue','Server Storage Issue','NAS Installation','NAS Configuration','File Sharing Issue','User Access / Permission Issue','Server Backup','Backup Failure','Data Restoration','RAID Issue','Server Maintenance'],
'PABX / VoIP':['PABX Installation','PABX Configuration','Telephone Line Issue','No Dial Tone','Extension Issue','New Extension Setup','VoIP Installation','VoIP Configuration','VoIP Call Quality Issue','IP Phone Installation','IP Phone Configuration'],
'Biometrics / Access Control':['Biometric Installation','Biometric Configuration','Fingerprint Enrollment','Face Recognition Enrollment','Employee/User Registration','Attendance System Issue','Access Control Installation','Door Access Issue','Magnetic Lock Issue','RFID Card Issue','RFID Enrollment','Access Control Maintenance'],
'Software / Application':['Software Installation','Software Configuration','Application Error','Login Issue','Password Reset','Account Creation','Account Access Issue','Software Update','Software License Issue','Database Issue','Application Backup','Application Migration'],
'Email / Cloud':['Email Account Setup','Email Login Issue','Email Password Reset','Cannot Send Email','Cannot Receive Email','Email Configuration','Gmail / Google Workspace Setup','Microsoft 365 Setup','Google Drive Issue','OneDrive Issue','Cloud Backup','Cloud File Sharing Issue'],
'Structured Cabling / Fiber':['LAN Cabling Installation','Fiber Optic Cabling','Cable Replacement','Cable Testing','Network Outlet Installation','Patch Panel Installation','Rack Installation','Network Rack Organization','Cable Management','Fiber Splicing','Fiber Testing','UTP Termination','RJ45 Replacement'],
'Hardware Installation':['Desktop Installation','Laptop Setup','Monitor Installation','Printer Installation','UPS Installation','Network Switch Installation','Router Installation','Access Point Installation','Server Installation','CCTV Hardware Installation'],
'Preventive Maintenance':['Computer Preventive Maintenance','Network Preventive Maintenance','CCTV Preventive Maintenance','Server Preventive Maintenance','Printer Preventive Maintenance','Fiber Network Inspection','Equipment Cleaning','System Health Check','Network Performance Check'],
'Site Survey / Inspection':['Site Inspection','Network Site Survey','CCTV Site Survey','Wi-Fi Site Survey','Fiber Route Survey','Equipment Assessment','Technical Consultation','Project Assessment','Quotation Request'],
'IT Project / Deployment':['New Network Setup','Office Network Deployment','CCTV System Deployment','Structured Cabling Project','Server Deployment','Wi-Fi Deployment','System Migration','Network Upgrade','CCTV Upgrade','Office IT Setup'],
'Other IT Services':['Other IT Service / Technical Support']};
const SERVICE_TYPES=['Installation','Repair','Troubleshooting','Configuration','Replacement','Upgrade','Relocation','Maintenance','Inspection','Consultation'];
const PRIORITIES=['Low','Normal','High','Urgent','Critical'];
const STATUSES=['New','Assigned','Acknowledged','On the Way','On Site','Diagnosing','In Progress','Waiting for Client','Waiting for Parts / Materials','For Reschedule','For Monitoring','Resolved','Completed','Cancelled'];
const RESOLUTIONS=['Fixed','Reconfigured','Replaced','Repaired','Reinstalled','Cable Replaced','Fiber Re-Spliced','Client Educated / Assisted','No Issue Found','For Replacement','For Further Investigation','Escalated'];
const TECHNICIANS=['Mark Anthony Francisco','Cyrus Miguel Saldo','Jezriel Jayobo','Ralf Wilson Manuel','John Lloyd Jayobo','Mark C. De Mesa'];
const n=v=>String(v||'').trim().toLowerCase();
function findCategory(concern,fallback){if(fallback&&categories[fallback])return fallback;const q=n(concern);for(const k of Object.keys(categories)){if(categories[k].some(v=>n(v)===q))return k}for(const k of Object.keys(categories)){if(q&&categories[k].some(v=>q.includes(n(v))||n(v).includes(q)))return k}return fallback||'Other IT Services'}
window.TechGeekServiceCatalog={categories,categoryNames:Object.keys(categories),SERVICE_TYPES,PRIORITIES,STATUSES,RESOLUTIONS,TECHNICIANS,concerns:c=>(categories[c]||[]).slice(),findCategory};

/* Technician Checklist: mobile card layout — no horizontal scrolling. */
if(/technician-checklist\.html$/i.test(location.pathname)){
  const style=document.createElement('style');
  style.id='techgeek-mobile-ticket-cards';
  style.textContent=`
  @media (max-width: 760px){
    .shell{padding:7px!important;overflow-x:hidden!important}
    .card{border:0!important;background:transparent!important;overflow:visible!important}
    .wrap{overflow:visible!important;max-height:none!important}
    .wrap table{display:block!important;width:100%!important;min-width:0!important;border-collapse:separate!important}
    .wrap thead{display:none!important}
    .wrap tbody{display:grid!important;gap:12px!important;width:100%!important}
    .wrap tr{display:block!important;width:100%!important;border:1px solid #dbe4ee!important;border-radius:12px!important;background:#fff!important;box-shadow:0 5px 16px rgba(20,43,70,.06)!important;overflow:hidden!important}
    .wrap td{display:grid!important;grid-template-columns:112px minmax(0,1fr)!important;gap:10px!important;align-items:start!important;width:100%!important;min-width:0!important;padding:9px 11px!important;border-right:0!important;border-bottom:1px solid #edf1f5!important;font-size:.72rem!important;white-space:normal!important;overflow-wrap:anywhere!important}
    .wrap td:last-child{border-bottom:0!important}
    .wrap td::before{color:#66758a!important;font-size:.6rem!important;font-weight:900!important;text-transform:uppercase!important;letter-spacing:.03em!important;line-height:1.35!important}
    .wrap td:nth-child(1)::before{content:'Ticket'}
    .wrap td:nth-child(2)::before{content:'Category'}
    .wrap td:nth-child(3)::before{content:'Concern / Service'}
    .wrap td:nth-child(4)::before{content:'Client / Location'}
    .wrap td:nth-child(5)::before{content:'Priority'}
    .wrap td:nth-child(6)::before{content:'Ticket Status'}
    .wrap td:nth-child(7)::before{content:'Checklist'}
    .wrap td:nth-child(8)::before{content:'Assigned Tech'}
    .wrap td:nth-child(9)::before{content:'Done / Updated By'}
    .wrap td:nth-child(10)::before{content:'Resolution'}
    .wrap td:nth-child(11)::before{content:'Action'}
    .wrap .checks{min-width:0!important;width:100%!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important}
    .wrap .bar{width:100%!important;align-self:center!important}
    .wrap .edit{width:100%!important;min-height:40px!important}
    .wrap .sub{font-size:.66rem!important;line-height:1.45!important;margin-top:4px!important}
    .wrap .badge{white-space:normal!important;text-align:center!important;justify-self:start!important}
    .toolbar{grid-template-columns:1fr 1fr!important}
    .toolbar .search,.toolbar .primary{grid-column:1/-1!important}
    .toolbar input[type=date]{width:100%!important}
  }
  @media (max-width: 430px){
    .wrap td{grid-template-columns:1fr!important;gap:4px!important;padding:9px 10px!important}
    .wrap td::before{margin-bottom:1px!important}
  }`;
  document.head.appendChild(style);
}

/* Shared client finder + Google Maps enhancement for Tickets and Technician Checklist. */
const ux=document.createElement('script');
ux.src='assets/client-map-enhancements.js?v=20260818-1';
ux.async=false;
document.head.appendChild(ux);
})();