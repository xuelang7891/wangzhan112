-- ==================================================================
-- 薛朗的资源仓库：多站长（多人共同维护）配置
-- 在 Supabase 控制台 → 左侧 SQL Editor → 新建查询，整段粘贴执行一次即可
-- ==================================================================

-- 1. 站长名单表（记录哪些邮箱拥有编辑权限）
create table if not exists public.site_admins (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table public.site_admins enable row level security;

-- 2. 判断「当前登录用户是不是站长」的函数
--    security definer：绕过 RLS 读取名单，避免把邮箱名单暴露给访客
create or replace function public.is_site_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.site_admins a
    where lower(a.email) = lower(coalesce(auth.email(), ''))
  );
$$;

grant execute on function public.is_site_admin() to anon, authenticated;

-- 名单本身的权限：仅站长可查看 / 添加 / 移除管理员
drop policy if exists site_admins_owner_read on public.site_admins;
create policy site_admins_owner_read on public.site_admins
  for select using (public.is_site_admin());

drop policy if exists site_admins_owner_write on public.site_admins;
create policy site_admins_owner_write on public.site_admins
  for all
  using (public.is_site_admin())
  with check (public.is_site_admin());

-- 3. 把现有站长加进名单（请确认这个邮箱已注册并激活过）
insert into public.site_admins (email)
values ('3902041497@qq.com')
on conflict (email) do nothing;

-- 4. 站点内容的写入权限：从「仅站长一人」改为「名单内任一成员可写」
alter table public.site_data enable row level security;

drop policy if exists site_data_write on public.site_data;
create policy site_data_write on public.site_data
  for all
  using (public.is_site_admin())
  with check (public.is_site_admin());

-- ==================================================================
-- 之后要加新站长，不用再跑 SQL：
-- Supabase 控制台 → Table Editor → site_admins → Insert row → 填邮箱 → Save
-- 对方再用这个邮箱在网站上「注册 → 邮箱激活 → 登录」即可成为站长。
-- 移除站长：在 site_admins 表里删掉那一行即可，立刻生效。
-- ==================================================================
