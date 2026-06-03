-- Run this in the Supabase SQL editor after creating the project.
-- It prevents non-school accounts from being inserted or updated in auth.users.

create or replace function public.enforce_school_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or lower(new.email) not like '%@stpaulhanoi.com' then
    raise exception 'Only @stpaulhanoi.com accounts are allowed.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_school_email_domain on auth.users;

create trigger enforce_school_email_domain
before insert or update of email on auth.users
for each row
execute function public.enforce_school_email_domain();
