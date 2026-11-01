import {createClient} from "npm:@supabase/supabase-js@2";
const s=(x:unknown)=>String(x??"").trim();
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST,OPTIONS"};
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","cache-control":"no-store",...cors}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({ok:false,message:"Method not allowed"},405);
 const url=s(Deno.env.get("SUPABASE_URL")),key=s(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
 if(!url||!key)return json({ok:false,message:"Backend not configured"},500);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
   const token=s(req.headers.get("authorization")).replace(/^Bearer\s+/i,"");
   const {data:u,error:ue}=await db.auth.getUser(token);
   if(ue||!u?.user?.id)return json({ok:false,message:"Login required"},401);
   const {data:staff}=await db.from("staff_profiles").select("role,active").eq("user_id",u.user.id).maybeSingle();
   if(!staff?.active||!["OWNER","ADMIN"].includes(s(staff.role).toUpperCase()))return json({ok:false,message:"Owner/Admin only"},403);
   const body=await req.json().catch(()=>({}));
   const action=s(body.action||"GET_STATUS").toUpperCase();
   if(action==="SAVE_SETTINGS"){
     if(typeof body.enabled!=="boolean"||typeof body.allow_auto_replies!=="boolean")return json({ok:false,message:"Invalid switches"},400);
     const {error}=await db.from("tg_ai_support_settings").update({
       enabled:body.enabled,allow_auto_replies:body.allow_auto_replies,require_telegram_approval:true,updated_at:new Date().toISOString()
     }).eq("id",1);
     if(error)throw error;
   }else if(action!=="GET_STATUS")return json({ok:false,message:"Unknown action"},400);
   const [{data:settings}, {data:tg}, {data:pending,count:pendingCount}, {data:recent}]=await Promise.all([
     db.from("tg_ai_support_settings").select("enabled,allow_auto_replies,require_telegram_approval,updated_at").eq("id",1).maybeSingle(),
     db.from("telegram_admin_settings").select("enabled,admin_chat_id,bot_token").eq("id",1).maybeSingle(),
     db.from("tg_ai_chat_requests").select("source_message_id",{count:"exact"}).eq("status","PENDING_APPROVAL").limit(1),
     db.from("tg_ai_chat_requests").select("source_message_id,request_type,status,fulfillment_status,created_at,decided_at").order("created_at",{ascending:false}).limit(20)
   ]);
   return json({ok:true,
     settings:{enabled:Boolean(settings?.enabled),allow_auto_replies:Boolean(settings?.allow_auto_replies),require_telegram_approval:true,updated_at:settings?.updated_at},
     readiness:{openai_key_configured:Boolean(s(Deno.env.get("OPENAI_API_KEY"))),telegram_configured:Boolean(tg?.enabled&&s(tg?.bot_token)&&/^[0-9]+$/.test(s(tg?.admin_chat_id)))},
     pending_count:pendingCount||0,recent:recent||[]});
 }catch(e){console.error("TG_AI_ADMIN",e instanceof Error?e.message:"error");return json({ok:false,message:"Unable to load AI support settings"},500)}
});
