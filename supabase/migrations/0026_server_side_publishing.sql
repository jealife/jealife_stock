-- ============================================================================
-- JEaLiFe Stock : publication côté serveur (suite de l'audit du 2026-10-17)
--
-- À appliquer APRÈS le déploiement du code qui publie via /api/publish-media :
-- l'ancien formulaire d'envoi écrivait la ligne `media` depuis le navigateur,
-- ce que cette migration interdit.
--
--   1. Plus d'INSERT dans `media` depuis le navigateur. Le contrôle qualité
--      et la modération (/api/moderate-upload) étaient appelés par le
--      formulaire, puis le navigateur écrivait lui-même la ligne : un client
--      modifié pouvait sauter le contrôle et publier n'importe quelle image
--      de son dossier. Seul le serveur publie désormais, après avoir relu
--      sur R2 les fichiers réellement déposés (voir /api/publish-media). Les
--      déclencheurs s'appliquent toujours : statut selon le mode de
--      modération, compte suspendu, fichiers Premium, prix.
--
--      Une même vignette ne peut appartenir qu'à un seul média.
--
--   2. Les colonnes de fichiers d'un média sont figées pour ses auteurs.
--      Un membre pouvait faire pointer la vignette ou la version web d'une
--      photo déjà validée vers une autre image de son dossier, jamais
--      contrôlée. Un changement de vignette (passage Gratuit / Premium)
--      passe par /api/replace-thumbnail, qui vérifie qu'il s'agit de la même
--      photo. Les admins et le serveur ne sont pas concernés.
--
-- Migration idempotente : elle peut être rejouée sans erreur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Publication réservée au serveur
-- ----------------------------------------------------------------------------
drop policy if exists "Chacun publie ses propres médias." on public.media;
revoke insert on public.media from anon, authenticated;
grant insert on public.media to service_role;

-- Une vignette n'appartient qu'à un seul média : deux requêtes de
-- publication parties en même temps (double clic, renvoi après une coupure
-- réseau) ne peuvent pas créer deux fiches pour les mêmes fichiers. Index
-- posé seulement si la base ne contient pas déjà de doublon.
do $$
begin
  if not exists (
    select 1 from public.media
     where thumbnail_url is not null
     group by thumbnail_url having count(*) > 1
  ) then
    create unique index if not exists media_thumbnail_url_key
      on public.media (thumbnail_url) where thumbnail_url is not null;
  else
    raise notice 'Vignettes en double dans media : index unique non créé.';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Fichiers figés pour les membres
--
--    Reprend `media_enforce_file_origin` (migration 0025), qui s'exécute en
--    premier parmi les déclencheurs de `media` (ordre alphabétique) : les
--    colonnes sont remises à leur valeur d'origine avant que
--    `media_protect_premium_files` ne fasse ses échanges Gratuit / Premium,
--    qui continuent donc de fonctionner.
-- ----------------------------------------------------------------------------
create or replace function public.media_enforce_file_origin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bases text[];
  v_base  text;
  v_url   text;
  v_ok    boolean;
begin
  -- Tâches serveur (clé de service, SQL Editor) et admins : non concernés.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.url           := old.url;
    new.thumbnail_url := old.thumbnail_url;
    new.original_url  := old.original_url;
    new.blur_data_url := old.blur_data_url;
    new.phash         := old.phash;
    new.type          := old.type;
    new.width         := old.width;
    new.height        := old.height;
    new.duration      := old.duration;
    new.file_size     := old.file_size;
    new.mime_type     := old.mime_type;
    return new;
  end if;

  -- INSERT par un membre : n'arrive plus depuis le retrait du droit
  -- ci-dessus. Le contrôle d'origine reste en place au cas où ce droit
  -- serait un jour rendu par erreur.
  v_bases := array_remove(
    regexp_split_to_array(coalesce(public.get_setting('media_base_urls'), ''), '\s+'),
    ''
  );
  if coalesce(array_length(v_bases, 1), 0) = 0 then
    return new;
  end if;

  foreach v_url in array array[new.url, new.thumbnail_url, new.original_url] loop
    continue when v_url is null;
    v_ok := false;
    foreach v_base in array v_bases loop
      if starts_with(v_url, v_base || new.user_id::text || '/') then
        v_ok := true;
        exit;
      end if;
    end loop;
    if not v_ok then
      raise exception 'Adresse de fichier non autorisée : les fichiers doivent être envoyés depuis le site.'
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.media_enforce_file_origin() from public, anon, authenticated;
