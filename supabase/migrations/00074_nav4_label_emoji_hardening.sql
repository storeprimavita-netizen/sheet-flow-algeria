-- NAV-4-F: harden label and emoji CHECKs (invisible fillers, plain text in emoji).
-- ZWJ (U+200D) stays legal in labels: family/profession emoji need it.

-- Defensive data fix: strip only the newly banned set from existing labels.
-- Rows whose labels would both end up blank are deleted first (a row needs one label).
delete from public.status_label_overrides
where nullif(btrim(regexp_replace(coalesce(label_en, ''), E'[\u061C\uFEFF\u2028\u2029\u00AD\u034F\u115F\u3164]', '', 'g')), '') is null
  and nullif(btrim(regexp_replace(coalesce(label_ar, ''), E'[\u061C\uFEFF\u2028\u2029\u00AD\u034F\u115F\u3164]', '', 'g')), '') is null
  and (label_en ~ E'[\u061C\uFEFF\u2028\u2029\u00AD\u034F\u115F\u3164]' or label_ar ~ E'[\u061C\uFEFF\u2028\u2029\u00AD\u034F\u115F\u3164]');

update public.status_label_overrides set
  label_en = nullif(btrim(regexp_replace(label_en, E'[\u061C\uFEFF\u2028\u2029\u00AD\u034F\u115F\u3164]', '', 'g')), ''),
  label_ar = nullif(btrim(regexp_replace(label_ar, E'[\u061C\uFEFF\u2028\u2029\u00AD\u034F\u115F\u3164]', '', 'g')), '')
where label_en ~ E'[\u061C\uFEFF\u2028\u2029\u00AD\u034F\u115F\u3164]'
   or label_ar ~ E'[\u061C\uFEFF\u2028\u2029\u00AD\u034F\u115F\u3164]';

alter table public.options drop constraint options_emoji_chk;
alter table public.options add constraint options_emoji_chk check (
  emoji is null or (
    char_length(emoji) between 1 and 16
    and emoji !~ '[[:cntrl:]]'
    and emoji !~ E'[​‌‎‏‪-‮⁦-⁩]'
    -- positive test: a pictograph, a flag (2 regional indicators) or a keycap.
    -- Superset of the JS regex (accepts some symbols such as arrows); zod stays the strict gate.
    and (
      emoji ~ E'[©®‼⁉™ℹ←-⇿⌚-⏿Ⓜ▪-◾☀-➿⤴⤵⬀-⯿〰〽㊗㊙\U0001F000-\U0001FAFF]'
      or emoji ~ E'[\U0001F1E6-\U0001F1FF]{2}'
      or emoji ~ E'[0-9#*]️?⃣'
    )
  )
);

alter table public.status_label_overrides drop constraint sl_en_chk;
alter table public.status_label_overrides drop constraint sl_ar_chk;
alter table public.status_label_overrides add constraint sl_en_chk check (label_en is null or (
  char_length(label_en) between 1 and 40 and label_en !~ '[[:cntrl:]]'
  and label_en !~ E'[​‌‎‏‪-‮⁦-⁩؜﻿  ­͏ᅟㅤ]'));
alter table public.status_label_overrides add constraint sl_ar_chk check (label_ar is null or (
  char_length(label_ar) between 1 and 40 and label_ar !~ '[[:cntrl:]]'
  and label_ar !~ E'[​‌‎‏‪-‮⁦-⁩؜﻿  ­͏ᅟㅤ]'));
