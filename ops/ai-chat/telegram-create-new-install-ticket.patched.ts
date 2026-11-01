import { createClient } from "npm:@supabase/supabase-js@2";

const clean=(v:unknown)=>String(v??"").trim();
const esc=(v:unknown)=>clean(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const uuidOk=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function tg(token:string,method:string,payload:any){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const out=await r.json().catch(()=>({}));if(!r.ok||out?.ok===false)throw new Error(`TELEGRAM_${method}_${r.status}:${clean(out?.description)||"error"}`);return out;}
async function createTicket(sb:any,token:string){const {data:pending,error:re}=await sb.from("telegram_pending_new_installations").select("id,action_token,messenger_psid,application_data,status,ticket_no,request_no,telegram_chat_id,telegram_message_id").eq("action_token",token).maybeSingle();if(re)throw re;if(!pending)return{ok:false,status_code:"NOT_FOUND"};const {data:result,error}=await sb.rpc("telegram_create_new_installation_ticket",{p_action_token:token});if(error)return{ok:false,status_code:"RPC_ERROR",pending,error:clean(error.message)};if(!result?.ok)return{ok:false,status_code:clean(result?.status_code)||"UNKNOWN_ERROR",pending,result};return{ok:true,ticket_no:clean(result.ticket_no),request_no:clean(result.request_no),already_created:result.already_created===true,pending};}
async function finishTicket(token:string,chat:string,messageId:number|null,app:any,ticketNo:string,requestNo:string,already:boolean){if(messageId){await tg(token,"editMessageReplyMarkup",{chat_id:chat,message_id:messageId,reply_markup:{inline_keyboard:[]}}).catch(()=>null);}if(!already){const applicant=[clean(app?.first_name),clean(app?.middle_name),clean(app?.surname)].filter(Boolean).join(" ");await tg(token,"sendMessage",{chat_id:chat,parse_mode:"HTML",disable_web_page_preview:true,text:["✅ <b>NEW INSTALLATION TICKET CREATED</b>","",`🎫 <b>Ticket No:</b> ${esc(ticketNo)}`,`🧾 <b>Request No:</b> ${esc(requestNo||"—")}`,`👤 <b>Applicant:</b> ${esc(applicant)}`].join("\n")});}}
async function deliverStaffReply(sb:any,bot:string,admin:string,msg:any,source:any,replyTo:number){const raw=clean(msg?.text||msg?.caption);if(!raw)return false;const from=[clean(msg?.from?.first_name),clean(msg?.from?.last_name)].filter(Boolean).join(" ")||clean(msg?.from?.username)||"TechGeekPH Support";const {data:staffMsg,error:staffErr}=await sb.from("client_chat_messages").insert({conversation_id:source.conversation_id,client_id:source.client_id,sender_type:"STAFF",sender_name:from,category:null,message_body:raw,telegram_message_id:Number(msg?.message_id||0)||null,telegram_reply_to_message_id:replyTo,delivery_status:"DELIVERED_CLIENT_APP"}).select("id").single();if(staffErr||!staffMsg)return false;await sb.from("client_chat_conversations").update({last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",source.conversation_id);const acct=clean(source?.client_chat_conversations?.account_no)||"client";await tg(bot,"sendMessage",{chat_id:admin,reply_to_message_id:Number(msg?.message_id||0)||undefined,allow_sending_without_reply:true,parse_mode:"HTML",text:`✅ Reply delivered to <b>${esc(acct)}</b>.`}).catch(()=>null);return true;}
const ticketMenu=(sourceId:number)=>({inline_keyboard:[
 [{text:"No Internet",callback_data:`chat_ticket_type:${sourceId}:NOINT`},{text:"Red LOS",callback_data:`chat_ticket_type:${sourceId}:LOS`}],
 [{text:"Slow Internet",callback_data:`chat_ticket_type:${sourceId}:SLOW`},{text:"Intermittent",callback_data:`chat_ticket_type:${sourceId}:INTERMITTENT`}],
 [{text:"Fiber Line",callback_data:`chat_ticket_type:${sourceId}:FIBER`},{text:"Modem / ONU",callback_data:`chat_ticket_type:${sourceId}:ROUTER`}],
 [{text:"Relocation",callback_data:`chat_ticket_type:${sourceId}:RELOCATE`},{text:"Disconnection",callback_data:`chat_ticket_type:${sourceId}:TERMINATE`}],
 [{text:"Billing",callback_data:`chat_ticket_type:${sourceId}:BILLING`},{text:"Payment",callback_data:`chat_ticket_type:${sourceId}:PAYMENT`}],
 [{text:"Other Concern",callback_data:`chat_ticket_type:${sourceId}:OTHER`}],
 [{text:"↩️ Back",callback_data:`chat_ticket_back:${sourceId}`}]
]});
const mainButtons=(sourceId:number,ticketNo?:string)=>({inline_keyboard:[[{text:"💬 Reply to Client",callback_data:`chat_reply:${sourceId}`},{text:ticketNo?`✅ ${ticketNo}`:"🎫 Create Ticket",callback_data:ticketNo?`chat_info:${sourceId}`:`chat_ticket:${sourceId}`}]]});

Deno.serve(async(req)=>{
 const url=clean(Deno.env.get("SUPABASE_URL")),key=clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
 if(!url||!key)return new Response("ok");
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  if(req.method!=="POST")return new Response("ok");
  const u=await req.json().catch(()=>({}));
  const {data:s}=await sb.from("telegram_admin_settings").select("bot_token,admin_chat_id,enabled").eq("id",1).maybeSingle();
  const bot=clean(s?.bot_token),admin=clean(s?.admin_chat_id);
  if(!s?.enabled||!bot||!admin)return new Response("ok");

  const msg=u?.message;
  if(msg){
    const chat=clean(msg?.chat?.id),raw=clean(msg?.text||msg?.caption),cmd=raw.toLowerCase().split("@")[0].trim();
    if(chat!==admin)return new Response("ok");
    const replyTo=Number(msg?.reply_to_message?.message_id||0)||null;
    if(replyTo&&raw){
      let source:any=null;
      const {data:prompt}=await sb.from("telegram_chat_reply_prompts").select("source_message_id").eq("prompt_message_id",replyTo).gt("expires_at",new Date().toISOString()).maybeSingle();
      if(prompt?.source_message_id){
        const {data:src}=await sb.from("client_chat_messages").select("id,conversation_id,client_id,telegram_message_id,client_chat_conversations(account_no)").eq("id",prompt.source_message_id).eq("sender_type","CLIENT").maybeSingle();source=src;
        await sb.from("telegram_chat_reply_prompts").delete().eq("prompt_message_id",replyTo);
      }else{
        const {data:src}=await sb.from("client_chat_messages").select("id,conversation_id,client_id,telegram_message_id,client_chat_conversations(account_no)").eq("telegram_message_id",replyTo).eq("sender_type","CLIENT").maybeSingle();source=src;
      }
      if(source){await deliverStaffReply(sb,bot,admin,msg,source,replyTo);return new Response("ok");}
    }
    if(cmd==="/duty"||cmd==="/onduty"){
      const {data,error}=await sb.rpc("app_on_duty_today");let out="👷 <b>EMPLOYEES ON DUTY TODAY</b>\n\n";
      if(error)out+="⚠️ Unable to load attendance right now.";else if(!data?.length)out+="No employees are currently on duty.";else out=`👷 <b>EMPLOYEES ON DUTY TODAY — ${data.length}</b>\n\n`+data.map((r:any,i:number)=>{const d=new Date(r.time_in);const tm=new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit",hour12:true}).format(d);return `${i+1}. 🟢 <b>${esc(r.employee_name)}</b> — ${esc(tm)}`}).join("\n");
      await tg(bot,"sendMessage",{chat_id:admin,text:out,parse_mode:"HTML"});return new Response("ok");
    }
    if(cmd==="/help"||cmd==="/start"){await tg(bot,"sendMessage",{chat_id:admin,parse_mode:"HTML",text:"🤖 <b>TechGeekPH Admin Commands</b>\n\n/duty — View employees on duty today\n\nClient Chat Center: Reply to Client, or choose Create Ticket then select the verified ticket type."});return new Response("ok");}
    return new Response("ok");
  }

  const cq=u?.callback_query;
  if(cq){
    const chat=clean(cq?.message?.chat?.id),data=clean(cq?.data);
    if(chat!==admin){if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Unauthorized admin action.",show_alert:true}).catch(()=>null);return new Response("ok");}

    // AI approval workflow: bind action to exact private admin, message and pending record.
    if(data.startsWith("ai:")){
      const parts=data.split(":"),action=parts[1],sourceId=Number(parts[2]),nonce=clean(parts[3]),sender=clean(cq?.from?.id);
      if(!["approve","reject","review"].includes(action)||!Number.isSafeInteger(sourceId)||sourceId<=0) return new Response("ok");
      if(!/^[0-9]+$/.test(admin)||sender!==admin){
        if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Only the authorized admin can approve.",show_alert:true}).catch(()=>null);
        return new Response("ok");
      }
      const {data:entry}=await sb.from("tg_ai_chat_requests")
        .select("source_message_id,conversation_id,client_id,status,telegram_message_id,approval_nonce,request_type,expires_at")
        .eq("source_message_id",sourceId).maybeSingle();
      const messageId=Number(cq?.message?.message_id||0);
      if(!entry||!messageId||Number(entry.telegram_message_id)!==messageId||!nonce||nonce!==clean(entry.approval_nonce)){
        if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"This approval message is not valid.",show_alert:true}).catch(()=>null);
        return new Response("ok");
      }
      if(entry.status!=="PENDING_APPROVAL"){
        if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Already handled: "+clean(entry.status),show_alert:true}).catch(()=>null);
        return new Response("ok");
      }
      if(!entry.expires_at||new Date(entry.expires_at).getTime()<=Date.now()){
        await sb.from("tg_ai_chat_requests").update({status:"EXPIRED",updated_at:new Date().toISOString()}).eq("source_message_id",sourceId).eq("status","PENDING_APPROVAL");
        if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"This approval expired. Please review manually.",show_alert:true}).catch(()=>null);
        return new Response("ok");
      }
      const outcome=action==="approve"?"APPROVED":action==="reject"?"REJECTED":"NEEDS_STAFF";
      const fulfillment=action==="approve"?"STAFF_ACTION_REQUIRED":"NOT_APPLICABLE";
      const stamp=new Date().toISOString();
      const {data:updated,error:updateErr}=await sb.from("tg_ai_chat_requests")
        .update({status:outcome,fulfillment_status:fulfillment,decided_at:stamp,decided_by:sender,updated_at:stamp})
        .eq("source_message_id",sourceId).eq("status","PENDING_APPROVAL").gt("expires_at",stamp)
        .select("source_message_id").maybeSingle();
      if(updateErr||!updated){
        if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Unable to finalize; retry or check status.",show_alert:true}).catch(()=>null);
        return new Response("ok");
      }
      const response=action==="approve"
        ?"Na-approve na po ng admin ang request ninyo para sa processing. I-aasikaso ito ng authorized staff; hindi pa po ibig sabihin ay completed na ang reconnection, billing adjustment, o account change. Mag-uupdate po kami kapag tapos na."
        :action==="reject"
        ?"Na-review po ng admin ang inyong request ngunit hindi ito na-approve sa ngayon. Maaari po kayong mag-message para makipag-usap sa staff tungkol sa ibang options."
        :"Naka-manual review po ang request ninyo sa TechGeekPH Admin. Magbibigay po kami ng update matapos itong masuri.";
      const {error:messageError}=await sb.from("client_chat_messages").insert({
        conversation_id:entry.conversation_id,client_id:entry.client_id,sender_type:"STAFF",
        sender_name:"TechGeekPH Support",category:"ADMIN_DECISION",message_body:response,
        source_key:"tg-ai-decision:"+sourceId,delivery_status:"DELIVERED_CLIENT_APP",
        metadata:{ai_approval_decision:outcome,request_id:sourceId,requires_staff_action:action==="approve"}
      });
      if(messageError)console.error("TG_AI_APPROVAL_CLIENT_MESSAGE",messageError.code||"unknown");
      await sb.from("client_chat_conversations").update({updated_at:stamp,last_message_at:stamp}).eq("id",entry.conversation_id);
      await tg(bot,"editMessageReplyMarkup",{chat_id:admin,message_id:messageId,reply_markup:{inline_keyboard:[]}}).catch(()=>null);
      const notice=action==="approve"
        ?"✅ <b>Approved for staff processing</b> — no automatic network or financial changes were made."
        :action==="reject"?"❌ <b>Rejected</b> — client notified."
        :"👤 <b>Manual review</b> — staff intervention required.";
      await tg(bot,"sendMessage",{chat_id:admin,text:notice+"\nRequest: "+esc(clean(entry.request_type))+"\nMessage ID: "+sourceId,parse_mode:"HTML",reply_to_message_id:messageId}).catch(()=>null);
      if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:action==="approve"?"Approved for staff processing.":action==="reject"?"Request rejected.":"Queued for manual review."}).catch(()=>null);
      return new Response("ok");
    }

    if(data.startsWith("chat_reply:")){
      const sourceId=Number(data.slice("chat_reply:".length));if(!Number.isFinite(sourceId)||sourceId<=0)return new Response("ok");
      const {data:source}=await sb.from("client_chat_messages").select("id,client_id,message_body,client_chat_conversations(account_no),clients(client_name)").eq("id",sourceId).eq("sender_type","CLIENT").maybeSingle();
      if(!source){if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Client message not found.",show_alert:true}).catch(()=>null);return new Response("ok");}
      const acct=clean((source as any)?.client_chat_conversations?.account_no),name=clean((source as any)?.clients?.client_name)||"Client";
      const prompt=await tg(bot,"sendMessage",{chat_id:admin,parse_mode:"HTML",text:`💬 Reply to <b>${esc(name)}</b> · <b>${esc(acct)}</b>\nType your reply below:`,reply_markup:{force_reply:true,input_field_placeholder:"Reply to client...",selective:true}});
      const promptId=Number(prompt?.result?.message_id||0);if(promptId)await sb.from("telegram_chat_reply_prompts").upsert({prompt_message_id:promptId,source_message_id:sourceId,telegram_chat_id:admin,expires_at:new Date(Date.now()+86400000).toISOString()});
      if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Reply box opened."}).catch(()=>null);return new Response("ok");
    }

    if(data.startsWith("chat_ticket:")){
      const sourceId=Number(data.slice("chat_ticket:".length));if(!Number.isFinite(sourceId)||sourceId<=0)return new Response("ok");
      const {data:source}=await sb.from("client_chat_messages").select("support_ticket_no").eq("id",sourceId).eq("sender_type","CLIENT").maybeSingle();
      if(source?.support_ticket_no){if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:`Ticket already exists: ${source.support_ticket_no}`,show_alert:true}).catch(()=>null);return new Response("ok");}
      if(cq?.message?.message_id)await tg(bot,"editMessageReplyMarkup",{chat_id:admin,message_id:cq.message.message_id,reply_markup:ticketMenu(sourceId)}).catch(()=>null);
      if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Select the verified ticket type."}).catch(()=>null);return new Response("ok");
    }

    if(data.startsWith("chat_ticket_back:")){
      const sourceId=Number(data.slice("chat_ticket_back:".length));if(cq?.message?.message_id&&sourceId>0)await tg(bot,"editMessageReplyMarkup",{chat_id:admin,message_id:cq.message.message_id,reply_markup:mainButtons(sourceId)}).catch(()=>null);if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Cancelled."}).catch(()=>null);return new Response("ok");
    }

    if(data.startsWith("chat_ticket_type:")){
      const parts=data.split(":");const sourceId=Number(parts[1]),code=clean(parts[2]).toUpperCase();if(!Number.isFinite(sourceId)||sourceId<=0||!code)return new Response("ok");
      if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Creating selected ticket…"}).catch(()=>null);
      const {data:result,error}=await sb.rpc("telegram_create_client_chat_ticket",{p_source_message_id:sourceId,p_ticket_code:code});
      if(error||!result?.ok){if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Ticket creation failed.",show_alert:true}).catch(()=>null);return new Response("ok");}
      const tno=clean(result.ticket_no),type=clean(result.ticket_type),already=result.already_created===true;
      await tg(bot,"sendMessage",{chat_id:admin,reply_to_message_id:Number(cq?.message?.message_id||0)||undefined,allow_sending_without_reply:true,parse_mode:"HTML",text:already?`ℹ️ Ticket already exists: <b>${esc(tno)}</b>`:`✅ <b>${esc(tno)}</b> created\nType: <b>${esc(type)}</b>\nClient was notified in the Client App.`}).catch(()=>null);
      if(cq?.message?.message_id)await tg(bot,"editMessageReplyMarkup",{chat_id:admin,message_id:cq.message.message_id,reply_markup:mainButtons(sourceId,tno)}).catch(()=>null);
      return new Response("ok");
    }

    if(data.startsWith("chat_info:")){
      const sourceId=Number(data.slice("chat_info:".length));const {data:source}=await sb.from("client_chat_messages").select("support_ticket_no").eq("id",sourceId).maybeSingle();if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:source?.support_ticket_no?`Ticket: ${source.support_ticket_no}`:"No ticket yet.",show_alert:true}).catch(()=>null);return new Response("ok");
    }

    if(!data.startsWith("create_ticket:"))return new Response("ok");
    const token=data.slice("create_ticket:".length);if(!uuidOk(token))return new Response("ok");
    if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:"Creating ticket…"}).catch(()=>null);
    const result=await createTicket(sb,token);if(!result.ok){const txt=result.status_code==="SEQUENCE_COLLISION_RETRY"?"Ticket number changed. Tap Create Ticket again.":"Ticket creation failed. Please try again.";if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:txt,show_alert:true}).catch(()=>null);return new Response("ok");}
    const p=result.pending,ticketNo=clean(result.ticket_no),requestNo=clean(result.request_no);if(ticketNo){await finishTicket(bot,admin,Number(p?.telegram_message_id||cq?.message?.message_id||0)||null,p?.application_data,ticketNo,requestNo,result.already_created).catch(()=>null);if(cq?.id)await tg(bot,"answerCallbackQuery",{callback_query_id:cq.id,text:result.already_created?`Already created: ${ticketNo}`:`Created: ${ticketNo}`}).catch(()=>null);}return new Response("ok");
  }
  return new Response("ok");
 }catch(e){console.error("TELEGRAM_HANDLER_V9",e instanceof Error?e.message:String(e));return new Response("ok");}
});