-- Dados do banco LOCAL, recriados a cada `npm run db:reset`. Nunca rodam em produção
-- (`supabase db push` não aplica o seed).

-- Usuário de desenvolvimento: dev@example.com / senha-local-123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000de',
  'authenticated', 'authenticated', 'dev@example.com',
  extensions.crypt('senha-local-123', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
values (
  gen_random_uuid(), '00000000-0000-0000-0000-0000000000de', '00000000-0000-0000-0000-0000000000de', 'email',
  '{"sub": "00000000-0000-0000-0000-0000000000de", "email": "dev@example.com", "email_verified": true}',
  now(), now()
);
