-- ============================================================================
-- JEaLiFe Stock : durcissement suite à l'audit du 2026-10-17
--
--   1. Les fichiers Premium étaient lisibles par n'importe qui.
--      `media.url` (version web 2400 px) et `media.original_url` (fichier
--      source) sont des colonnes publiques : la policy de lecture de `media`
--      laisse voir toute ligne publiée, et une policy RLS filtre des LIGNES,
--      jamais des colonnes. La clé publique Supabase étant dans le code du
--      site, une simple requête
--        GET /rest/v1/media?select=original_url&is_premium=eq.true
--      rendait l'original de chaque média Premium, sans achat. La route
--      /api/photo-access ne protégeait donc que l'interface, pas les données.
--      Désormais, pour un média Premium, les vraies adresses vivent dans
--      `media_premium_files` (lisible seulement par l'auteur, un acheteur ou
--      un admin) et les colonnes publiques ne portent plus que la vignette
--      filigranée. Un déclencheur fait le tri à chaque écriture : le
--      formulaire d'envoi et la page de modification n'ont rien à changer.
--
--   2. Origine des fichiers verrouillée. La ligne `media` est écrite
--      directement par le navigateur : rien n'empêchait d'y enregistrer
--      l'adresse d'une image hébergée ailleurs (contournant le contrôle
--      qualité et la modération) ou celle du fichier d'un autre membre.
--      Chaque adresse doit maintenant pointer vers le stockage du site, dans
--      le dossier de l'auteur (`<base>/<user_id>/...`). Les bases autorisées
--      se règlent dans `site_settings.media_base_urls` (séparées par des
--      espaces), pré-rempli ici à partir des médias existants.
--
--   3. Compteurs. Un téléchargement anonyme n'était jamais compté (seuls les
--      membres connectés laissaient une trace) alors que c'est l'usage
--      majoritaire d'une banque d'images : le tri « populaire », le hero
--      d'accueil et les statistiques des contributeurs étaient faussés.
--      Les téléchargements anonymes sont maintenant journalisés, dédupliqués
--      par visiteur et par jour, comme les vues. `record_view` et ce nouveau
--      journal ne sont plus appelables que par le serveur (clé de service) :
--      appelée directement en RPC avec des clés inventées, `record_view`
--      permettait de gonfler les vues de n'importe quelle photo.
--
--   4. Pays représentés comptés par la base (le comptage côté site
--      plafonnait à 1 000 photos).
--
--   5. Index manquants pour les requêtes les plus fréquentes.
--
--   0. (en premier ci-dessous) Les compteurs étaient figés depuis la 0024.
--      `media_before_write` remet les compteurs à leur ancienne valeur pour
--      tout UPDATE fait par un non-admin. Le recalcul nocturne
--      (`sync_media_counters`, appelé avec la clé de service) n'a pas de
--      session : `auth.uid()` y vaut NULL, donc `is_admin()` est faux, et
--      chaque nuit le déclencheur annulait le recalcul. Constaté en
--      production : aucune des photos publiées depuis le 19 août n'affichait
--      la moindre vue. Les vues et téléchargements, eux, ont bien été
--      journalisés pendant ce temps : rien n'est perdu, le prochain passage
--      du cron remet tout à jour. Même garde que `protect_profile_privileges`
--      (migration 0004) : la protection ne vise que les sessions membres.
--
-- Migration idempotente : elle peut être rejouée sans erreur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. media_before_write : ne verrouiller que les sessions membres
-- ----------------------------------------------------------------------------
create or replace function public.media_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.profiles where id = new.user_id and is_suspended) then
      raise exception 'Ce compte a été suspendu et ne peut plus publier.' using errcode = '42501';
    end if;

    if not public.is_admin() then
      new.status := case
        when public.get_setting('moderation_mode') = 'manual' then 'pending'::public.media_status
        else 'published'::public.media_status
      end;
    end if;
  end if;

  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_admin() then
    if exists (select 1 from public.profiles where id = old.user_id and is_suspended) then
      raise exception 'Ce compte a été suspendu et ne peut plus modifier ses envois.' using errcode = '42501';
    end if;

    new.status := old.status;
    new.user_id := old.user_id;
    new.likes_count := old.likes_count;
    new.views_count := old.views_count;
    new.downloads_count := old.downloads_count;
    new.views_count_baseline := old.views_count_baseline;
    new.downloads_count_baseline := old.downloads_count_baseline;
  end if;

  new.geo_priority := public.geo_priority_for(new.country_code);

  new.orientation := case
    when new.width is null or new.height is null then null
    when new.width > new.height then 'paysage'
    when new.height > new.width then 'portrait'
    else 'carre'
  end;

  new.search_vector :=
      setweight(to_tsvector('public.fr_unaccent', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('public.fr_unaccent', array_to_string(coalesce(new.tags, '{}'), ' ')), 'A')
    || setweight(to_tsvector('public.fr_unaccent', coalesce(new.alt_text, '')), 'B')
    || setweight(to_tsvector('public.fr_unaccent', coalesce(new.location, '')), 'B')
    || setweight(to_tsvector('public.fr_unaccent', coalesce(new.city, '')), 'B')
    || setweight(to_tsvector('public.fr_unaccent',
         coalesce((select c.name_fr from public.countries c where c.code = new.country_code), '')), 'B')
    || setweight(to_tsvector('public.fr_unaccent', coalesce(new.description, '')), 'C')
    || setweight(to_tsvector('public.fr_unaccent', coalesce(new.camera, '')), 'D');

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. Fichiers Premium privés
-- ----------------------------------------------------------------------------
create table if not exists public.media_premium_files (
  -- Contrainte différée : le déclencheur écrit ici AVANT que la ligne
  -- `media` elle-même n'existe (déclencheur BEFORE INSERT). La vérification
  -- se fait donc à la fin de la transaction, quand les deux lignes existent.
  media_id     bigint primary key
               references public.media(id) on delete cascade
               deferrable initially deferred,
  url          text not null,
  original_url text,
  updated_at   timestamptz not null default now()
);

alter table public.media_premium_files enable row level security;

-- Aucune policy d'écriture : seul le déclencheur ci-dessous (security
-- definer) écrit dans cette table.
drop policy if exists "Auteur, acheteur ou admin lisent les fichiers Premium." on public.media_premium_files;
create policy "Auteur, acheteur ou admin lisent les fichiers Premium."
  on public.media_premium_files for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.media m
      where m.id = media_premium_files.media_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.premium_downloads d
      where d.media_id = media_premium_files.media_id and d.buyer_id = auth.uid()
    )
  );

revoke insert, update, delete on public.media_premium_files from anon, authenticated;
grant select on public.media_premium_files to authenticated;
grant all on public.media_premium_files to service_role;

-- Reprise des médias Premium déjà publiés, avant la pose du déclencheur.
insert into public.media_premium_files (media_id, url, original_url)
select id, url, original_url
  from public.media
 where is_premium
   and thumbnail_url is not null
   and (url is distinct from thumbnail_url or original_url is not null)
on conflict (media_id) do nothing;

update public.media
   set url = thumbnail_url,
       original_url = null
 where is_premium
   and thumbnail_url is not null
   and (url is distinct from thumbnail_url or original_url is not null);

create or replace function public.media_protect_premium_files()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_files public.media_premium_files%rowtype;
begin
  if new.is_premium then
    -- Une vraie adresse arrive dans les colonnes publiques (envoi, passage
    -- en Premium, remplacement de fichier) : elle part dans la table privée
    -- et la vignette filigranée prend sa place. Sans vignette (cas ancien,
    -- ne devrait plus exister), rien de sûr à afficher à la place : on
    -- laisse en l'état plutôt que de casser la fiche.
    if new.thumbnail_url is not null
       and (new.url is distinct from new.thumbnail_url or new.original_url is not null) then
      select * into v_files from public.media_premium_files where media_id = new.id;

      insert into public.media_premium_files as f (media_id, url, original_url, updated_at)
      values (
        new.id,
        case
          when new.url is distinct from new.thumbnail_url then new.url
          else coalesce(v_files.url, new.url)
        end,
        coalesce(new.original_url, v_files.original_url),
        now()
      )
      on conflict (media_id) do update
        set url = excluded.url,
            original_url = excluded.original_url,
            updated_at = now();

      new.url := new.thumbnail_url;
      new.original_url := null;
    end if;

  elsif tg_op = 'UPDATE' and old.is_premium then
    -- Retour en gratuit : les vraies adresses reprennent leur place.
    select * into v_files from public.media_premium_files where media_id = new.id;
    if found then
      if new.url is not distinct from old.url then
        new.url := v_files.url;
      end if;
      if new.original_url is null then
        new.original_url := v_files.original_url;
      end if;
      delete from public.media_premium_files where media_id = new.id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.media_protect_premium_files() from public, anon, authenticated;

drop trigger if exists media_protect_premium_files on public.media;
create trigger media_protect_premium_files
  before insert or update on public.media
  for each row execute function public.media_protect_premium_files();

-- ----------------------------------------------------------------------------
-- 2. Origine des fichiers
-- ----------------------------------------------------------------------------

-- Bases déduites des médias déjà publiés (stockage R2 actuel, ancien
-- stockage Supabase). Vide sur une base neuve : le contrôle reste alors
-- inactif tant qu'un admin n'a pas renseigné le réglage, plutôt que de
-- bloquer tous les envois.
insert into public.site_settings (key, value)
select 'media_base_urls', coalesce(string_agg(distinct base, ' '), '')
  from (
    select substring(url from '^(https://[^/]+/(?:storage/v1/object/public/media/)?)') as base
      from public.media
  ) bases
 where base is not null
on conflict (key) do nothing;

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

  v_bases := array_remove(
    regexp_split_to_array(coalesce(public.get_setting('media_base_urls'), ''), '\s+'),
    ''
  );
  if coalesce(array_length(v_bases, 1), 0) = 0 then
    return new;
  end if;

  foreach v_url in array array[new.url, new.thumbnail_url, new.original_url] loop
    continue when v_url is null;

    -- Une adresse déjà en base n'est pas revérifiée (fiches publiées avant
    -- ce contrôle, retour d'un média Premium en gratuit).
    if tg_op = 'UPDATE' and v_url in (old.url, old.thumbnail_url, old.original_url) then
      continue;
    end if;
    if tg_op = 'UPDATE' and exists (
      select 1 from public.media_premium_files f
       where f.media_id = new.id and v_url in (f.url, f.original_url)
    ) then
      continue;
    end if;

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

-- Nom choisi pour passer AVANT `media_protect_premium_files` (les
-- déclencheurs d'un même moment s'exécutent par ordre alphabétique) :
-- l'adresse est contrôlée telle que l'a envoyée le navigateur.
drop trigger if exists media_enforce_file_origin on public.media;
create trigger media_enforce_file_origin
  before insert or update on public.media
  for each row execute function public.media_enforce_file_origin();

-- ----------------------------------------------------------------------------
-- 3. Compteurs : téléchargements anonymes, appels réservés au serveur
-- ----------------------------------------------------------------------------
create table if not exists public.media_anon_downloads (
  id            bigint generated by default as identity primary key,
  media_id      bigint not null references public.media(id) on delete cascade,
  viewer_key    text not null,
  downloaded_on date not null default current_date,
  created_at    timestamptz not null default now(),
  unique (media_id, viewer_key, downloaded_on)
);

create index if not exists media_anon_downloads_media_idx on public.media_anon_downloads (media_id);
create index if not exists media_anon_downloads_created_idx on public.media_anon_downloads (created_at);

alter table public.media_anon_downloads enable row level security;

drop policy if exists "Un admin peut consulter le journal des téléchargements anonymes." on public.media_anon_downloads;
create policy "Un admin peut consulter le journal des téléchargements anonymes."
  on public.media_anon_downloads for select using (public.is_admin());

create or replace function public.record_anonymous_download(p_media_id bigint, p_viewer_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.media_anon_downloads (media_id, viewer_key)
  values (p_media_id, p_viewer_key)
  on conflict (media_id, viewer_key, downloaded_on) do nothing;
end;
$$;

revoke all on function public.record_anonymous_download(bigint, text) from public, anon, authenticated;
grant execute on function public.record_anonymous_download(bigint, text) to service_role;

revoke all on function public.record_view(bigint, text) from public, anon, authenticated;
grant execute on function public.record_view(bigint, text) to service_role;

create or replace function public.sync_media_counters()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.media m
     set views_count = m.views_count_baseline + v.n
    from (select media_id, count(*) as n from public.media_views group by media_id) v
   where m.id = v.media_id
     and m.views_count is distinct from (m.views_count_baseline + v.n);

  update public.media m
     set downloads_count = m.downloads_count_baseline + d.n
    from (
      select media_id, count(*) as n
        from (
          select media_id from public.media_downloads
          union all
          select media_id from public.media_anon_downloads
        ) all_downloads
       group by media_id
    ) d
   where m.id = d.media_id
     and m.downloads_count is distinct from (m.downloads_count_baseline + d.n);

  update public.profiles p
     set total_views = p.total_views_baseline + v.n
    from (
      select m.user_id, count(*) as n
        from public.media_views mv
        join public.media m on m.id = mv.media_id
       group by m.user_id
    ) v
   where p.id = v.user_id
     and p.total_views is distinct from (p.total_views_baseline + v.n);

  update public.profiles p
     set total_downloads = p.total_downloads_baseline + d.n
    from (
      select m.user_id, count(*) as n
        from (
          select media_id from public.media_downloads
          union all
          select media_id from public.media_anon_downloads
        ) all_downloads
        join public.media m on m.id = all_downloads.media_id
       group by m.user_id
    ) d
   where p.id = d.user_id
     and p.total_downloads is distinct from (p.total_downloads_baseline + d.n);

  -- Les fenêtres de limitation de débit ne servent plus au-delà de quelques
  -- minutes ; sans ménage, chaque vue anonyme y laissait une ligne pour
  -- toujours.
  delete from public.api_rate_limits where window_start < now() - interval '2 days';
end;
$$;

revoke all on function public.sync_media_counters() from public, anon, authenticated;
grant execute on function public.sync_media_counters() to service_role;

-- ----------------------------------------------------------------------------
-- 4. Pays représentés, comptés par la base
--
--    Le filtre pays et la page /pays rapatriaient jusqu'ici 1 000 lignes de
--    `media` pour les compter dans le navigateur : au-delà de 1 000 photos
--    (plafond de réponse de Supabase), les chiffres devenaient faux et des
--    pays disparaissaient du filtre. `security invoker` : la RLS de `media`
--    s'applique, seuls les médias publiés sont comptés.
-- ----------------------------------------------------------------------------
create or replace function public.get_active_countries()
returns table (code char(2), name_fr text, slug text, is_african boolean, media_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.code, c.name_fr, c.slug, c.is_african, count(*) as media_count
    from public.media m
    join public.countries c on c.code = m.country_code
   where m.status = 'published'
   group by c.code, c.name_fr, c.slug, c.is_african
   order by count(*) desc, c.name_fr;
$$;

grant execute on function public.get_active_countries() to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Index
-- ----------------------------------------------------------------------------

-- Tri « récent » et onglets de profil.
create index if not exists media_recent_idx
  on public.media (type, status, created_at desc);
create index if not exists media_user_recent_idx
  on public.media (user_id, created_at desc);

-- « Ce média est-il dans une collection ? » et suppressions en cascade : la
-- clé primaire de `collection_media` commence par `collection_id`.
create index if not exists collection_media_media_idx
  on public.collection_media (media_id);

-- Vérification d'achat (/api/photo-access, policy ci-dessus).
create index if not exists premium_downloads_buyer_media_idx
  on public.premium_downloads (buyer_id, media_id);

-- Courbes de téléchargements du tableau de bord admin.
create index if not exists media_downloads_created_idx
  on public.media_downloads (created_at);
