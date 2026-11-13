-- ============================================================================
-- MNW COD ERP v2 — reference seed (58 wilayas) + per-workspace seeding
-- ============================================================================

insert into public.wilayas (code, name) values
  (1,'Adrar'), (2,'Chlef'), (3,'Laghouat'), (4,'Oum El Bouaghi'), (5,'Batna'),
  (6,'Béjaïa'), (7,'Biskra'), (8,'Béchar'), (9,'Blida'), (10,'Bouira'),
  (11,'Tamanrasset'), (12,'Tébessa'), (13,'Tlemcen'), (14,'Tiaret'), (15,'Tizi Ouzou'),
  (16,'Alger'), (17,'Djelfa'), (18,'Jijel'), (19,'Sétif'), (20,'Saïda'),
  (21,'Skikda'), (22,'Sidi Bel Abbès'), (23,'Annaba'), (24,'Guelma'), (25,'Constantine'),
  (26,'Médéa'), (27,'Mostaganem'), (28,'M''Sila'), (29,'Mascara'), (30,'Ouargla'),
  (31,'Oran'), (32,'El Bayadh'), (33,'Illizi'), (34,'Bordj Bou Arreridj'), (35,'Boumerdès'),
  (36,'El Tarf'), (37,'Tindouf'), (38,'Tissemsilt'), (39,'El Oued'), (40,'Khenchela'),
  (41,'Souk Ahras'), (42,'Tipaza'), (43,'Mila'), (44,'Aïn Defla'), (45,'Naâma'),
  (46,'Aïn Témouchent'), (47,'Ghardaïa'), (48,'Relizane'), (49,'Timimoun'),
  (50,'Bordj Badji Mokhtar'), (51,'Ouled Djellal'), (52,'Béni Abbès'), (53,'In Salah'),
  (54,'In Guezzam'), (55,'Touggourt'), (56,'Djanet'), (57,'El M''Ghair'), (58,'El Meniaa');

-- Called by bootstrap_workspace() (00001_core.sql) and, later, by the SaaS
-- signup flow. Idempotent.
create or replace function public.seed_workspace(p_ws uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- one fee row per wilaya (fees start at 0; admin fills real values in Settings)
  insert into public.wilaya_fees (workspace_id, wilaya_code)
  select p_ws, code from public.wilayas
  on conflict do nothing;

  insert into public.settings (workspace_id, key, value) values
    (p_ws, 'return_fee',         '{"amount": 150}'),
    (p_ws, 'duplicate_window',   '{"hours": 48}'),
    (p_ws, 'risk_weights',       '{"returned": 2, "cancelled": 1, "no_answer": 0.5}'),
    (p_ws, 'stop_shipping_rule', '{"min_orders": 10, "min_delivery_rate": 40}'),
    (p_ws, 'meeting_schedule',   '{"slots": [{"dow": 1, "time": "20:00"}, {"dow": 4, "time": "20:00"}]}')
  on conflict do nothing;
end; $$;
