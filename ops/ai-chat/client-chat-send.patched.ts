import { createClient } from "npm:@supabase/supabase-js@2";

const clean=(v:unknown)=>String(v??"").trim();
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8",...cors}});
const CHAT_BUCKET="chat-images";
const MAX_IMAGE_BYTES=5*1024*1024;
const ALLOWED_IMAGES=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
const extFor=(mime:string)=>mime==="image/png"?"png":mime==="image/webp"?"webp":mime==="image/heic"?"heic":mime==="image/heif"?"heif":"jpg";

function kickAiSupport(messageId:number){
  // Isolated server-to-server worker. No credentials go to the browser.
  const url=clean(Deno.env.get("SUPABASE_URL")),key=clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if(!url||!key||!Number.isSafeInteger(messageId)||messageId<=0)return;
  const task=fetch(url+"/functions/v1/tg-ai-chat-worker",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+key,apikey:key},
    body:JSON.stringify({message_id:messageId})
  }).then(async response=>{
    if(!response.ok)console.error("TG_AI_WORKER_HTTP",response.status);
  }).catch(error=>console.error("TG_AI_WORKER_TRANSPORT",error instanceof Error?error.message:"error"));
  const runtime=(globalThis as any).EdgeRuntime;
  if(runtime&&typeof runtime.waitUntil==="function")runtime.waitUntil(task);
  else void task;
}

async function sha256(v:string){const bytes=new TextEncoder().encode(v);const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");}
async function signMessageImage(sb:any,message:any){
  const path=clean(message?.metadata?.image_path);
  if(!path)return message;
  const {data,error}=await sb.storage.from(CHAT_BUCKET).createSignedUrl(path,60*60);
  return error||!data?.signedUrl?message:{...message,image_url:data.signedUrl};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,code:"METHOD_NOT_ALLOWED",message:"Method not allowed"},405);
  try{
    const url=clean(Deno.env.get("SUPABASE_URL")),key=clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    if(!url||!key)return json({ok:false,code:"SERVER_CONFIG",message:"Server configuration error."},500);
    const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

    const contentType=clean(req.headers.get("content-type")).toLowerCase();
    let body:any={};
    let form:FormData|null=null;
    if(contentType.includes("multipart/form-data")){
      form=await req.formData();
      body={token:form.get("token"),message:form.get("message"),caption:form.get("caption"),action:form.get("action"),mark_read:form.get("mark_read")};
    }else{
      body=await req.json().catch(()=>({}));
    }

    const token=clean(body?.token);
    const action=clean(body?.action||"send").toLowerCase();
    if(!token)return json({ok:false,code:"SESSION_REQUIRED",message:"Please sign in again."},401);

    const tokenHash=await sha256(token);
    const {data:session,error:sessionErr}=await sb.from("client_portal_sessions").select("id,client_id,expires_at,revoked_at").eq("token_hash",tokenHash).is("revoked_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
    if(sessionErr)return json({ok:false,code:"SESSION_LOOKUP_FAILED",message:sessionErr.message},500);
    if(!session)return json({ok:false,code:"SESSION_INVALID",message:"Your session has expired. Please sign out and sign in again."},401);
    await sb.from("client_portal_sessions").update({last_seen_at:new Date().toISOString()}).eq("id",session.id);

    const {data:client,error:clientErr}=await sb.from("clients").select("id,account_no,client_name").eq("id",session.client_id).maybeSingle();
    if(clientErr)return json({ok:false,code:"CLIENT_LOOKUP_FAILED",message:clientErr.message},500);
    if(!client)return json({ok:false,code:"CLIENT_NOT_FOUND",message:"Client account was not found."},404);

    let convId:string|null=null;
    const {data:existing,error:findErr}=await sb.from("client_chat_conversations").select("id,status,client_last_read_at").eq("client_id",client.id).maybeSingle();
    if(findErr)return json({ok:false,code:"CONVERSATION_LOOKUP_FAILED",message:findErr.message},500);
    if(existing?.id){
      convId=String(existing.id);
      if(action!=="thread")await sb.from("client_chat_conversations").update({account_no:client.account_no,status:"OPEN",updated_at:new Date().toISOString()}).eq("id",convId);
    }else{
      const {data:newConv,error:createErr}=await sb.from("client_chat_conversations").insert({client_id:client.id,account_no:client.account_no,status:"OPEN",last_message_at:new Date().toISOString()}).select("id").single();
      if(createErr)return json({ok:false,code:"CONVERSATION_CREATE_FAILED",message:createErr.message},500);
      convId=String(newConv.id);
    }

    if(action==="thread"){
      const {data:conv,error:convErr}=await sb.from("client_chat_conversations").select("id,client_last_read_at").eq("id",convId).maybeSingle();
      if(convErr)return json({ok:false,code:"CONVERSATION_LOOKUP_FAILED",message:convErr.message},500);
      const {data:messages,error:msgErr}=await sb.from("client_chat_messages").select("id,conversation_id,client_id,sender_type,sender_name,category,message_body,delivery_status,read_at,created_at,support_ticket_no,metadata").eq("conversation_id",convId).order("created_at",{ascending:true}).limit(300);
      if(msgErr)return json({ok:false,code:"MESSAGE_LOOKUP_FAILED",message:msgErr.message},500);
      const readAt=conv?.client_last_read_at?new Date(conv.client_last_read_at).getTime():0;
      const unread=(messages||[]).filter((m:any)=>clean(m.sender_type).toUpperCase()==="STAFF"&&(!readAt||new Date(m.created_at).getTime()>readAt)).length;
      const markRead=body?.mark_read===true||clean(body?.mark_read).toLowerCase()==="true"||clean(body?.mark_read)==="1";
      if(markRead&&unread>0){
        await sb.from("client_chat_conversations").update({client_last_read_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",convId);
      }
      const signed=await Promise.all((messages||[]).map((m:any)=>signMessageImage(sb,m)));
      return json({ok:true,client_name:client.client_name,account_no:client.account_no,conversation_id:convId,messages:signed,unread:markRead?0:unread});
    }

    if(action==="send_image"){
      const caption=clean(body?.caption||body?.message);
      if(caption.length>1500)return json({ok:false,code:"MESSAGE_TOO_LONG",message:"Caption is too long. Maximum is 1,500 characters."},400);
      const file=form?.get("file");
      if(!(file instanceof File))return json({ok:false,code:"IMAGE_REQUIRED",message:"Choose a photo first."},400);
      const mime=clean(file.type).toLowerCase();
      if(!ALLOWED_IMAGES.has(mime))return json({ok:false,code:"IMAGE_TYPE_NOT_ALLOWED",message:"Only JPG, PNG, WEBP, HEIC, and HEIF images are allowed."},400);
      if(file.size>MAX_IMAGE_BYTES)return json({ok:false,code:"IMAGE_TOO_LARGE",message:"Photo is too large. Maximum file size is 5 MB."},400);

      const safeName=`${Date.now()}-${crypto.randomUUID()}.${extFor(mime)}`;
      const path=`client/${client.id}/${convId}/${safeName}`;
      const bytes=await file.arrayBuffer();
      const {error:uploadErr}=await sb.storage.from(CHAT_BUCKET).upload(path,bytes,{contentType:file.type,upsert:false,cacheControl:"3600"});
      if(uploadErr)return json({ok:false,code:"IMAGE_UPLOAD_FAILED",message:`Photo upload failed: ${uploadErr.message}`},500);

      const metadata={kind:"image",image_path:path,image_mime:file.type,image_name:clean(file.name)||safeName,image_size:file.size};
      const {data:msg,error:insErr}=await sb.from("client_chat_messages").insert({conversation_id:convId,client_id:client.id,sender_type:"CLIENT",sender_name:client.client_name,category:"IMAGE",message_body:caption||"📷 Photo",delivery_status:"SAVED",metadata}).select("id,created_at,metadata,message_body").single();
      if(insErr){await sb.storage.from(CHAT_BUCKET).remove([path]).catch(()=>undefined);return json({ok:false,code:"MESSAGE_SAVE_FAILED",message:insErr.message},500);}
      await sb.from("client_chat_conversations").update({status:"OPEN",last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",convId);
      const signed=await signMessageImage(sb,msg);
      kickAiSupport(Number(msg.id));
      return json({ok:true,message_id:msg.id,telegram:false,image:true,image_url:signed?.image_url||null});
    }

    const message=clean(body?.message);
    if(!message)return json({ok:false,code:"MESSAGE_REQUIRED",message:"Type a message first."},400);
    if(message.length>1500)return json({ok:false,code:"MESSAGE_TOO_LONG",message:"Message is too long. Maximum is 1,500 characters."},400);

    const {data:msg,error:insErr}=await sb.from("client_chat_messages").insert({conversation_id:convId,client_id:client.id,sender_type:"CLIENT",sender_name:client.client_name,category:null,message_body:message,delivery_status:"SAVED"}).select("id,created_at").single();
    if(insErr)return json({ok:false,code:"MESSAGE_SAVE_FAILED",message:insErr.message},500);
    await sb.from("client_chat_conversations").update({status:"OPEN",last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",convId);

    // Dispatch AI processing in background, Telegram is reserved for approval.
    kickAiSupport(Number(msg.id));
    return json({ok:true,message_id:msg.id,telegram:false});
  }catch(e){console.error("CLIENT_CHAT_SEND_V11",e);return json({ok:false,code:"UNEXPECTED_ERROR",message:e instanceof Error?e.message:"Unable to send message right now."},500);}
});
