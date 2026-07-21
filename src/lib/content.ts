import "server-only";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const entityTables = ["competitions","upcoming_competitions","certificates","education","projects","experiences","awards","skills","links"] as const;
export type EntityTable = typeof entityTables[number];

const demos: Record<string, Array<Record<string, unknown>>> = {
  projects: [
    { id:"demo-smartbite", slug:"smartbiteai-demo", title_en:"SmartBiteAI [Demo]", title_zh:"SmartBiteAI【示例】", summary_en:"An AI-assisted nutrition companion that turns everyday meals into practical insight.", summary_zh:"将日常饮食转化为实用洞察的 AI 营养助手。", tech_stack:["Next.js","AI"], status:"published", visibility:"public", is_featured:true, sort_order:10, updated_at:"2026-06-01" },
    { id:"demo-nekoya", slug:"nekoya-order-system-demo", title_en:"Nekoya Order System [Demo]", title_zh:"Nekoya 点餐系统【示例】", summary_en:"A clear, fast ordering workflow designed for a busy small restaurant.", summary_zh:"为繁忙小型餐厅打造的清晰快速点餐流程。", tech_stack:["TypeScript","Supabase"], status:"published", visibility:"public", is_featured:true, sort_order:20, updated_at:"2026-05-20" },
    { id:"demo-retention", slug:"retentionx-demo", title_en:"RetentionX [Demo]", title_zh:"RetentionX【示例】", summary_en:"A focused product analytics dashboard for understanding retention.", summary_zh:"用于理解用户留存的产品分析仪表板。", tech_stack:["React","Analytics"], status:"published", visibility:"public", is_featured:false, sort_order:30, updated_at:"2026-04-10" },
  ],
  competitions: [{ id:"demo-comp", slug:"innovation-hackathon-demo", title_en:"Innovation Hackathon [Demo]", title_zh:"创新黑客松【示例】", summary_en:"A collaborative sprint from idea to working prototype.", summary_zh:"从创意到可用原型的团队冲刺。", competition_date:"2026-05-16", organizer:"Demo Organizer", award:"Finalist", status:"published", visibility:"public", is_featured:true, sort_order:10, updated_at:"2026-05-18" }],
  upcoming_competitions: [{ id:"demo-upcoming", slug:"future-build-challenge-demo", title_en:"Future Build Challenge [Demo]", title_zh:"未来创作挑战【示例】", summary_en:"Exploring a future innovation competition.", summary_zh:"正在探索的未来创新比赛。", competition_date:"2026-11-08", registration_status:"interested", official_url:"https://example.com", status:"published", visibility:"public", is_featured:true, sort_order:10, updated_at:"2026-06-12" }],
  certificates: [{ id:"demo-cert", slug:"cloud-foundations-demo", title_en:"Cloud Foundations [Demo]", title_zh:"云计算基础【示例】", summary_en:"A removable sample certificate.", summary_zh:"可删除的证书示例。", issuer:"Demo Academy", issued_at:"2026-03-01", status:"published", visibility:"public", is_featured:true, sort_order:10, updated_at:"2026-03-01" }],
  skills: ["TypeScript","Product Design","Communication","Next.js","Supabase"].map((name,i)=>({ id:`demo-skill-${i}`, slug:name.toLowerCase().replaceAll(" ","-"), title_en:name, title_zh:name, skill_category:i===1?"Design":i===2?"Communication":"Programming", proficiency:i===0?"advanced":"proficient", status:"published", visibility:"public", is_featured:true, sort_order:i*10, updated_at:"2026-01-01" })),
  education: [], experiences: [], awards: [], links: [],
};

export async function listContent(table: EntityTable, options: { admin?: boolean; archived?: boolean; q?: string; limit?: number } = {}) {
  if (!isSupabaseConfigured()) {
    const rows = demos[table] ?? [];
    return rows.filter(row => !options.q || String(row.title_en).toLowerCase().includes(options.q.toLowerCase()));
  }
  const supabase = await createClient();
  let query = supabase.from(table).select("*").order("sort_order").order("updated_at", { ascending:false }).limit(options.limit ?? 50);
  if (!options.admin) query = query.eq("status","published").eq("visibility","public");
  else if (options.archived) query = query.eq("status","archived");
  else query = query.neq("status","archived");
  if (options.q) query = query.or(`title_en.ilike.%${options.q.replace(/[%_,()]/g, "")}%,title_zh.ilike.%${options.q.replace(/[%_,()]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data as Array<Record<string, unknown>>;
}

export async function siteProfile() {
  if (!isSupabaseConfigured()) return { name_en:"Your Name", name_zh:"你的名字", headline_en:"Builder, learner & creative technologist", headline_zh:"创作者、学习者与科技实践者", bio_en:"A personal space for the work, competitions, credentials and experiences that shaped me.", bio_zh:"记录塑造我的项目、比赛、证书与经历的个人空间。" };
  const supabase = await createClient();
  const { data } = await supabase.from("site_profile").select("*").single();
  return data;
}

export async function publicStats() {
  const [competitions, certificates, projects, awards, experiences] = await Promise.all([
    listContent("competitions"), listContent("certificates"), listContent("projects"), listContent("awards"), listContent("experiences"),
  ]);
  return { competitions:competitions.length, certificates:certificates.length, projects:projects.length, awards:awards.length, experiences:experiences.length };
}

export async function getPublicContent(table:EntityTable,slug:string){
  if(!isSupabaseConfigured())return(demos[table]??[]).find(row=>row.slug===slug)??null;
  const supabase=await createClient();
  const{data,error}=await supabase.from(table).select("*").eq("slug",slug).eq("status","published").eq("visibility","public").maybeSingle();
  if(error)throw new Error(error.message);
  return data as Record<string,unknown>|null;
}
