begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

select is(
  (select count(*)::integer from app.get_staff_invitation_preview('invalid-token-value-that-is-long-enough')),
  0,
  'an unknown token reveals no invitation'
);

select has_function(
  'app',
  'get_staff_invitation_preview',
  array['text'],
  'the invitation preview function exists'
);

select ok(
  has_function_privilege('anon', 'app.get_staff_invitation_preview(text)', 'EXECUTE'),
  'anonymous users may preview only by token'
);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) privilege
    where procedure.oid = 'app.get_staff_invitation_preview(text)'::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0,
  'PUBLIC receives no implicit function permission'
);

select * from finish();
rollback;
