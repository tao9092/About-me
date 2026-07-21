-- Clearly labelled, removable demo data. Run after the initial migration.
insert into public.categories(name_en,name_zh,slug,entity_type,sort_order) values
('AI & Data','人工智能与数据','ai-data',null,10),('Web Development','网页开发','web-development',null,20),('Hackathon','黑客松','hackathon','competition',30),('Professional','专业证书','professional','certificate',40);
insert into public.tags(name_en,name_zh,slug,sort_order) values
('Demo Data','示例数据','demo-data',0),('TypeScript','TypeScript','typescript',10),('AI','人工智能','ai',20),('Teamwork','团队合作','teamwork',30);

insert into public.projects(title_en,title_zh,slug,summary_en,summary_zh,content_en,content_zh,tech_stack,visibility,status,is_featured,sort_order,published_at,is_demo)
values
('SmartBiteAI [Demo]','SmartBiteAI【示例】','smartbiteai-demo','Demo nutrition assistant project. Replace or delete it from the admin.','示例营养助手项目，可在后台替换或删除。','<p>This is demo data.</p>','<p>这是示例数据。</p>',array['Next.js','AI'],'public','published',true,10,now(),true),
('Nekoya Order System [Demo]','Nekoya 点餐系统【示例】','nekoya-order-system-demo','Demo ordering workflow for a small restaurant.','小型餐厅点餐流程示例。','<p>This is demo data.</p>','<p>这是示例数据。</p>',array['TypeScript','Supabase'],'public','published',true,20,now(),true),
('RetentionX [Demo]','RetentionX【示例】','retentionx-demo','Demo retention analytics dashboard.','用户留存分析仪表板示例。','<p>This is demo data.</p>','<p>这是示例数据。</p>',array['React','Analytics'],'public','published',false,30,now(),true);

insert into public.competitions(title_en,title_zh,slug,summary_en,summary_zh,competition_date,organizer,competition_type,award,visibility,status,is_featured,published_at,is_demo)
values('Innovation Hackathon [Demo]','创新黑客松【示例】','innovation-hackathon-demo','A removable example competition.','可删除的比赛示例。','2026-05-16','Demo Organizer','Hackathon','Finalist','public','published',true,now(),true);
insert into public.upcoming_competitions(title_en,title_zh,slug,summary_en,summary_zh,competition_date,official_url,registration_status,competition_type,visibility,status,is_featured,published_at,is_demo)
values('Future Build Challenge [Demo]','未来创作挑战【示例】','future-build-challenge-demo','A removable upcoming competition.','可删除的未来比赛示例。','2026-11-08','https://example.com','interested','Innovation','public','published',true,now(),true);
insert into public.certificates(title_en,title_zh,slug,summary_en,summary_zh,issuer,issued_at,visibility,status,is_featured,published_at,is_demo)
values('Cloud Foundations [Demo]','云计算基础【示例】','cloud-foundations-demo','A removable certificate placeholder.','可删除的证书示例。','Demo Academy','2026-03-01','public','published',true,now(),true);
insert into public.skills(title_en,title_zh,slug,skill_category,proficiency,visibility,status,is_featured,sort_order,published_at,is_demo) values
('TypeScript','TypeScript','typescript','Programming','advanced','public','published',true,10,now(),true),
('Product Design','产品设计','product-design','Design','proficient','public','published',true,20,now(),true),
('Communication','沟通','communication','Communication','proficient','public','published',true,30,now(),true);
