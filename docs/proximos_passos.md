# Próximos passos — login único, admin, super admin e assinatura

Implementado e publicado em 14/10/2026. Leia antes a seção
"Autenticação e contas" do `CLAUDE.md`. `git status` mostra todos os arquivos alterados.

## O que mudou

- **Banco:** `supabase/migrations/20261014120000_contas_e_assinatura.sql`
  - papel `admin` (um por transportadora) e `usuarios.primeiro_acesso`
  - tabela `plataforma_admins` (super admin) e assinatura em `tenants`
    (avaliação de 30 dias, carência de 10, ativo/`pago_ate`, bloqueado, vitalício)
  - `app.tenant_id()` fecha todo o acesso quando a assinatura vence
  - `meu_acesso()` com colunas novas; funções `usuarios_da_empresa`, `definir_acesso_usuario`,
    `concluir_primeiro_acesso`, `sou_superadmin`, `plataforma_empresas`, `plataforma_usuarios`,
    `plataforma_assinatura`
  - transportadoras que já existiam viram `vitalicio`; o gestor mais antigo de cada uma vira admin
- **Edge Function:** `supabase/functions/gerenciar-usuario` (criar gestor, criar acesso de
  motorista, redefinir senha; usa a `service_role`)
- **App:** `entrar.tsx` (E-mail ou CPF + senha), `trocar-senha.tsx`, `assinatura.tsx`,
  `plataforma.tsx` (super admin), `gestor/usuarios.tsx` (admin), faixa de avaliação no painel,
  estados novos no `SessaoContext`; `ativar.tsx` removido; PIN só no celular
- Motorista entra com o CPF; o e-mail interno dele é `<cpf>@motorista.g2frota.vercel.app`
- `supabase/config.toml`: login anônimo desligado; `verify_jwt = false` na `gerenciar-usuario`
- `npm run test:db`: 24/24 passando. `tsc` passou.

## Feito em 14/10/2026

- Lint e `tsc` limpos (`npm run lint` agora roda `expo lint src`: a pasta `APP/` do APK
  confundia o `expo lint` no Windows).
- Telas testadas no navegador com o Supabase simulado: login (e-mail e CPF), troca de senha,
  cadastro → transportadora → painel, Usuários (criar gestor, acesso de motorista, religar,
  erro da função), assinatura vencida/carência, plataforma do super admin.
- Publicado: migration aplicada, `gerenciar-usuario` no ar, login anônimo desligado,
  tipos gerados de novo, commit e push (Vercel publica sozinha).
- App Android: `eas update` no canal `preview` ("Login com CPF e senha"). Motoristas com
  aparelho ativado pelo código antigo continuam funcionando até o admin criar o login deles
  em Usuários (isso desliga o aparelho antigo).

- Super admin `beto.garbin@gmail.com` criado com senha temporária (migration
  `superadmin_primeiro_acesso`: troca obrigatória no primeiro login).

## Pendente, nesta ordem

1. Preencher `WHATSAPP_ASSINATURA` em `src/constants/assinatura.ts` (DDI + DDD + número, só
   dígitos). Enquanto estiver vazio, o botão "Assinar" fica escondido.
2. Dar acesso aos motoristas da Garbin em Gestor > Usuários > "+ Acesso de motorista" e
   passar o CPF e a senha temporária para cada um.

3. **E-mail próprio (SMTP) — adiado pelo Gilberto em 16/10/2026.** O Frota (e o FLUXO) usam o
   envio gratuito do Supabase: ~2 e-mails/hora e só para quem é da equipe no Supabase. Clientes
   não recebem a confirmação do cadastro nem o link de "Esqueci minha senha". Plano: conta no
   Resend, domínio g2fluxo.com.br (ex.: nao-responda@), SMTP no painel do Supabase e então
   ativar o modelo em português (`supabase/templates/recuperar-senha.html`, bloco comentado
   no `config.toml`). No FLUXO, só com autorização dele.

## Decisões já tomadas com o Gilberto

- A transportadora se cadastra sozinha pelo site, com período de avaliação.
- Assinatura igual à do FLUXO: PIX combinado pelo WhatsApp e liberação manual (+30 dias,
  +365 dias, vitalícia).
- O admin faz tudo; o gestor não gerencia usuários.
- O motorista também acessa pela web.
