-- NAV-4-F review 1: Braille blank banned, labels need a visible character,
-- emoji CHECK anchored (every character must belong to the emoji set).

-- invisible / filler set (ZWJ included: it is legal inside a label but never alone)
-- U+2800 U+200B-200F U+2060 U+FEFF U+FFA0 U+1160 U+115F U+3164 U+180E U+00A0 U+00AD U+034F U+061C U+E0000-E007F + whitespace

-- data: U+2800 is now banned outright
delete from public.status_label_overrides
where nullif(btrim(regexp_replace(coalesce(label_en, ''), E'⠀', '', 'g')), '') is null
  and nullif(btrim(regexp_replace(coalesce(label_ar, ''), E'⠀', '', 'g')), '') is null
  and (label_en ~ E'⠀' or label_ar ~ E'⠀');
update public.status_label_overrides set
  label_en = nullif(btrim(regexp_replace(label_en, E'⠀', '', 'g')), ''),
  label_ar = nullif(btrim(regexp_replace(label_ar, E'⠀', '', 'g')), '')
where label_en ~ E'⠀' or label_ar ~ E'⠀';

-- data: a label made only of invisible characters is cleared; a row left with none is deleted
delete from public.status_label_overrides
where nullif(btrim(regexp_replace(coalesce(label_en, ''), E'[[:space:]​-‏⁠﻿ﾠᅠᅟㅤ᠎ ­͏؜\U000E0000-\U000E007F]', '', 'g')), '') is null
  and nullif(btrim(regexp_replace(coalesce(label_ar, ''), E'[[:space:]​-‏⁠﻿ﾠᅠᅟㅤ᠎ ­͏؜\U000E0000-\U000E007F]', '', 'g')), '') is null;
update public.status_label_overrides set
  label_en = case when regexp_replace(label_en, E'[[:space:]​-‏⁠﻿ﾠᅠᅟㅤ᠎ ­͏؜\U000E0000-\U000E007F]', '', 'g') = '' then null else label_en end,
  label_ar = case when regexp_replace(label_ar, E'[[:space:]​-‏⁠﻿ﾠᅠᅟㅤ᠎ ­͏؜\U000E0000-\U000E007F]', '', 'g') = '' then null else label_ar end;

alter table public.status_label_overrides drop constraint sl_en_chk;
alter table public.status_label_overrides drop constraint sl_ar_chk;
alter table public.status_label_overrides add constraint sl_en_chk check (label_en is null or (
  char_length(label_en) between 1 and 40 and label_en !~ '[[:cntrl:]]'
  and label_en !~ E'[​‌‎‏‪-‮⁦-⁩؜﻿  ­͏ᅟㅤ⠀]'
  and regexp_replace(label_en, E'[[:space:]​-‏⁠﻿ﾠᅠᅟㅤ᠎ ­͏؜\U000E0000-\U000E007F]', '', 'g') <> ''));
alter table public.status_label_overrides add constraint sl_ar_chk check (label_ar is null or (
  char_length(label_ar) between 1 and 40 and label_ar !~ '[[:cntrl:]]'
  and label_ar !~ E'[​‌‎‏‪-‮⁦-⁩؜﻿  ­͏ᅟㅤ⠀]'
  and regexp_replace(label_ar, E'[[:space:]​-‏⁠﻿ﾠᅠᅟㅤ᠎ ­͏؜\U000E0000-\U000E007F]', '', 'g') <> ''));

-- emoji: anchored. Allowed characters only: the pictograph ranges, regional indicators,
-- ZWJ, VS16, tag characters, keycap pieces; plus at least one real pictograph / flag / keycap.
alter table public.options drop constraint options_emoji_chk;
alter table public.options add constraint options_emoji_chk check (
  emoji is null or (
    char_length(emoji) between 1 and 16
    and emoji ~ E'^([©®‼⁉™ℹ←-⇿⌚-⏿Ⓜ▪-◾☀-➿⤴⤵⬀-⯿〰〽㊗㊙\U0001F000-\U0001FAFF‍️\U000E0020-\U000E007F⃣#*0-9])+$'
    and (
      emoji ~ E'[©®‼⁉™ℹ←-⇿⌚-⏿Ⓜ▪-◾☀-➿⤴⤵⬀-⯿〰〽㊗㊙\U0001F000-\U0001FAFF]'
      or emoji ~ E'[\U0001F1E6-\U0001F1FF]{2}'
      or emoji ~ E'[0-9#*]️?⃣'
    )
  )
);
