# Convite e recuperação de senha usam os e-mails padrão do Supabase

Os e-mails de convite e de recuperação de senha saem com o modelo padrão do Supabase (em inglês), e o app trata o retorno desse link: a pessoa volta à Site URL já com a sessão no fragmento da URL, e `routeEmailLink` a leva para a tela de definir senha. Fizemos assim porque, desde junho de 2026, projetos novos no plano gratuito só podem editar os modelos de e-mail com SMTP próprio, e não queremos depender de mais um serviço.

## Consequences

- O link é gasto ao ser aberto. Um leitor de e-mail que pré-carregue links pode inutilizar o convite, que então precisa ser reenviado.
- O servidor de e-mail padrão envia cerca de 2 mensagens por hora para o projeto inteiro.
- O formato com `token_hash` (que só gasta o token ao enviar o formulário) continua aceito, e os modelos em português estão em `supabase/templates/`. Com SMTP configurado, basta ativá-los, sem mudar código.
