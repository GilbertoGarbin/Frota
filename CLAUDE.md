@AGENTS.md

# Frota

SaaS de gestão de micro-frotas (Garbin Transportes): transportadoras com 2 a 10 caminhões
controlam viagens, motoristas, veículos, combustível, despesas e resultado financeiro.

Dois lados de uso dentro de cada conta (tenant):

- **App do Motorista** — Android, celular, sinal instável na estrada. Confirma viagens, lança
  abastecimento/despesa/parada/carga extra, anexa documentos, acompanha adiantamento.
- **Painel do Gestor** — web, desktop-first. Cadastra viagens e motoristas, acompanha margem
  por viagem, apura combustível, fecha o financeiro.

## Documentação (ler antes de modelar ou desenhar telas)

- [docs/decisao_stack_infra.md](docs/decisao_stack_infra.md) — decisões de stack, banco, offline, autenticação e hospedagem. **Fonte de verdade de infra.**
- [docs/briefing_tecnico_stack.md](docs/briefing_tecnico_stack.md) — resumo do produto, entidades e lógica de negócio não-trivial.
- [docs/especificacao_revisada_app_motorista.md](docs/especificacao_revisada_app_motorista.md) — telas, campos, paleta e regras do app do motorista.
- [docs/especificacao_revisada_gestao_frotas.md](docs/especificacao_revisada_gestao_frotas.md) — telas do gestor, adiantamento, lançamentos do gestor e apuração de combustível (seção 5c).
- [docs/prototipo_motorista.html](docs/prototipo_motorista.html) e [docs/prototipo_gestor.html](docs/prototipo_gestor.html) — protótipos navegáveis (layout de referência; gestor usa sidebar fixa escura).

## Stack

Mesma do projeto FLUXO (`D:\Projetos\FLUXO`), usado como referência de organização:

- **Expo SDK 56 + Expo Router + TypeScript + React Native Web** — um único código para Android e web.
- **Supabase** (projeto próprio, São Paulo): Postgres, Auth, Storage, Edge Functions. Cliente em `src/lib/supabase.ts`.
- **expo-sqlite** — fila offline do motorista (novidade em relação ao FLUXO).
- **Android:** APK via EAS Build; correções de JS via EAS Update.
- **Web:** `npm run build:web` (`expo export -p web`), publicado na Vercel por deploy automático do GitHub.
- Sem API/servidor separado no MVP. Edge Functions: `gerenciar-usuario` (criar login e redefinir
  senha precisam da `service_role`) e `ler-nota` (lê o PDF/XML da nota fiscal do posto e devolve os
  dados para preencher o abastecimento; as regras ficam em `supabase/functions/ler-nota/nota.ts`).

## Organização

```
src/app/         rotas (Expo Router) — só telas e layouts
src/components/  componentes de UI
src/services/    acesso a dados e regras por domínio
src/db/          SQLite local (fila offline) e tipos
src/lib/         clientes (supabase)
src/constants/   tema e tokens
src/utils/       formatação e helpers
supabase/        migrations e edge functions
```

- Import com alias `@/` → `src/`.
- Telas do gestor que precisem de tabelas densas, filtros ou gráficos usam arquivos `*.web.tsx`.
- Regras compartilhadas (comissão, adiantamento, totais) são escritas uma vez e usadas pelos dois lados.

## Regras obrigatórias

### Dinheiro
- Valores monetários em **`numeric(12,2)`** no banco — nunca `float`/`real`/`double`.
- No TypeScript, não fazer aritmética de dinheiro com `number` em ponto flutuante: calcular no banco ou em centavos inteiros.

### Multi-tenant
- Schema único. **Toda tabela tem `tenant_id`** e **Row-Level Security habilitada** com política por tenant.
- Nenhuma tabela é criada sem RLS; nenhuma consulta depende de filtro de tenant feito só no cliente.
- A chave `service_role` nunca entra no app nem em variável `EXPO_PUBLIC_*`.

### Offline do motorista (outbox)
- Lançamentos (abastecimento, despesa, parada, carga extra, documento) são gravados **primeiro no SQLite local** (`expo-sqlite`), com **UUID gerado no aparelho**, e enviados por uma fila quando houver sinal.
- Servidor **idempotente**: reenviar o mesmo UUID nunca duplica.
- Fotos comprimidas no aparelho (~300 KB) e enviadas pela mesma fila.
- Não é sincronização completa do banco: o celular baixa só as viagens e o veículo do próprio motorista.

### Regras de negócio no banco
- Rateio de combustível, recálculo de consumo médio, comissão e conciliação de adiantamento são **funções Postgres** (transação única), complementadas por Edge Functions quando necessário.
- O rateio é baseado em **km, não em ordem de chegada** — precisa ser determinístico e idempotente, porque um abastecimento pode sincronizar atrasado.
- Campos derivados (comissão, frete total, resultado operacional) nunca são editáveis na UI.

### Autenticação e contas (migration `contas_e_assinatura`)
- **Login único** (`src/app/entrar.tsx`): "E-mail ou CPF" + senha, na web e no app. O papel vem do
  banco (`meu_acesso`), não da tela. Motorista não tem e-mail: o login dele no Supabase Auth é
  `<cpf>@motorista.g2frota.vercel.app` (`DOMINIO_LOGIN_MOTORISTA`, igual no app e na Edge Function).
- Papéis em `usuarios.papel`: **admin** (um por transportadora — índice `usuarios_um_admin_por_tenant`;
  faz tudo), **gestor** (painel, sem gerenciar usuários), **motorista**. `app.eh_gestor()` vale para
  admin e gestor; `app.eh_admin()` só para o admin.
- **Cadastro pelo site** (`cadastro.tsx` → `transportadora.tsx` → `criar_tenant`): quem cria a
  transportadora vira o admin, com 30 dias de avaliação.
- O admin cria gestores (e-mail) e acessos de motorista (CPF) em `gestor/usuarios.tsx`, pela Edge
  Function `supabase/functions/gerenciar-usuario`, sempre com **senha temporária**:
  `usuarios.primeiro_acesso` obriga a trocar no login seguinte (`trocar-senha.tsx`).
- **Super admin** (dono do sistema): tabela `plataforma_admins` (fora dos tenants — a única sem
  `tenant_id`). Vê todas as transportadoras e usuários, redefine senhas e controla a assinatura em
  `src/app/plataforma.tsx` (funções `plataforma_*`). Para criar: criar o login no Auth com senha
  temporária e inserir o `auth.users.id` em `plataforma_admins` com `primeiro_acesso = true`
  (obriga a trocar a senha no primeiro login, via `minha_plataforma()`).
- **Assinatura** por transportadora em `tenants` (`assinatura_status`, `trial_expira_em`, `pago_ate`,
  `carencia_dias`), como no FLUXO: PIX manual pelo WhatsApp (`src/constants/assinatura.ts`) e o super
  admin libera +30/+365 dias. Passada a carência, `app.tenant_id()` fica nulo e o RLS fecha tudo;
  `meu_acesso` continua respondendo para o app mostrar `assinatura.tsx`.
- A ativação antiga por código (`gerar_codigo_ativacao`/`ativar_aparelho`, sessão anônima) ficou só no
  banco, sem tela; sessões anônimas estão desligadas em `supabase/config.toml`.
- O PIN é só desbloqueio local no celular (hash com sal em `expo-secure-store`,
  `src/services/pin.service.ts`); nunca é enviado ao servidor. 5 erros fazem sair da conta. Na web não há PIN.
- Estado da sessão e roteamento: `src/context/SessaoContext.tsx` + `Stack.Protected` em
  `src/app/_layout.tsx`. Cada estado (`deslogado`, `sem_transportadora`, `plataforma`,
  `primeiro_acesso`, `assinatura_vencida`, `gestor`, `motorista`) libera só as rotas dele;
  `src/app/index.tsx` redireciona. Telas do gestor ficam em `src/app/gestor/`, as do motorista em
  `src/app/motorista/` (atrás do `PinPortao`).
- O acesso (papel + transportadora) fica salvo no aparelho para o motorista abrir o app sem sinal.
- Configuração de Auth do projeto: `supabase/config.toml` (`npx supabase config push`).

## Banco de dados

Migrations em `supabase/migrations/` (aplicar em ordem). Testes em `supabase/tests/`, rodando
num Postgres embutido (PGlite): **`npm run test:db` — rodar sempre que mexer em migration.**

- Identidade nas políticas RLS: `app.tenant_id()`, `app.eh_gestor()`, `app.motorista_id()`,
  `app.viagem_do_motorista(id)`, `app.viagem_aberta_do_motorista(id)`. O schema `app` não é
  exposto pela API; funções chamadas pelo app ficam em `public` e são usadas via `supabase.rpc`.
- **Motorista não lê a tabela `viagens`** (ela tem combustível e margem). Usa
  `viagens_do_motorista()`, `iniciar_viagem`, `finalizar_viagem`, `criar_viagem_motorista`.
  Lançamentos (abastecimentos, despesas, complementos, paradas, documentos) ele grava direto,
  com `insert ... on conflict (id) do nothing`, só enquanto a viagem está em andamento.
- Derivados de `viagens` (frete total, comissão, despesas, gasto do adiantamento) são
  recalculados por trigger a cada gravação; valor enviado pelo cliente é ignorado.
- Formas de pagamento de abastecimento/despesa: `adiantamento` e `proprio_bolso` entram no saldo do
  motorista; `cartao_empresa`, `pix_empresa` (empresa paga o posto por PIX, com `chave_pix`) e `a_prazo`
  (nota assinada no posto, com `vencimento`) não. Os dois últimos aparecem em "A pagar aos postos"
  (Financeiro) até o gestor preencher `pago_em` — o motorista nunca marca como pago (trigger).
- Clientes e recebimento do frete: `clientes` (cadastro simples) e `formas_recebimento` (nome +
  `parcelas` jsonb: percentual, base saída/entrega, dias, corridos/úteis, dia da semana; o trigger
  confere que somam 100). A viagem tem `cliente_id` opcional (sem cadastro = só `cliente` em texto,
  frete avulso) e `forma_recebimento_id`; sem forma escolhida herda a do cliente, e o nome da forma vai
  para `forma_pagamento_frete` (texto que o motorista vê).
- Contas: `recebimentos` (parcelas do frete pelo botão "Gerar recebimentos" = `gerar_recebimentos`, e
  complementos do tipo 'complemento') e `pagamentos` (criados por trigger ao lançar abastecimento/despesa
  e pelo adiantamento da viagem; `cartao_empresa` nasce pago, `adiantamento` não gera). Valor e
  vencimento do que não foi quitado se refazem quando a viagem muda (`app.recalcular_recebimentos`).
  Marcar recebido/pago é só no Financeiro > Receber / Pagar; o lançamento só mostra a situação.
- Combustível: `app.recalcular_combustivel(veiculo_id)` refaz janelas, rateio e estimativas do
  veículo inteiro a partir dos dados gravados (ver comentário na migration). `janelas_consumo`
  é tabela derivada — nunca gravar nela.
- Canhoto: `tenants.exige_canhoto` é o padrão da transportadora (tela `gestor/configuracoes.tsx`, só o admin,
  via `minhas_configuracoes`/`salvar_configuracoes`); `viagens.exige_canhoto` nasce com esse padrão (trigger
  quando não vem valor) e o gestor troca na viagem. `finalizar_viagem` só cobra o canhoto se a viagem exige.
  Configurações novas da transportadora entram nessa mesma tela e nas mesmas duas funções.
- Arquivos: bucket privado `comprovantes`, caminho `{tenant_id}/{viagem_id}/{uuid}.{ext}`.
- Nova tabela = `tenant_id` + FK composta `(tenant_id, x_id)` + RLS + teste de isolamento.
- Edge Functions em `supabase/functions/` (Deno; fora do `tsc` e do ESLint do app). Deploy:
  `npx supabase functions deploy <nome>`.
- Tipos do banco em `src/db/database.types.ts` (gerado — não editar). Depois de aplicar uma migration:
  `npx supabase gen types typescript --linked --schema public > src/db/database.types.ts`
  (salvar em UTF-8 sem BOM).

## Painel do gestor

- Casca com menu lateral escuro em `src/app/gestor/_layout.tsx` (vira faixa no topo abaixo de 900 px).
  Item novo no menu = entrada em `MENU` + arquivo em `src/app/gestor/`.
- Cada tela usa `Pagina` (`src/components/gestor/pagina.tsx`), `Tabela`, `Selo`, `Segmentado`, `Campo`
  e `Botao` de `src/components/ui/`. Lista e formulário ficam no mesmo arquivo de rota; o formulário
  substitui a lista enquanto está aberto.
- Formulários de cadastro e de lançamento abrem numa **janela por cima** (`Janela`,
  `src/components/ui/janela.tsx`), com a lista visível atrás. Rodapé sempre com **Salvar e Cancelar**
  juntos. Campos lado a lado com `LinhaForm`; obrigatórios com `*`; faltas e erros na `Mensagem`.
  A janela deixa os campos compactos (altura 40) e mostra o `ajuda` de cada `Campo` como um ⓘ
  ao lado do rótulo (balão ao passar o mouse ou tocar), para não desalinhar os campos.
- Escolhas no painel: **3 opções ou mais = lista** (`Seletor`); **2 opções = botões** (`Segmentado`).
  No app do motorista as escolhas continuam em botões grandes (celular, uso no posto).
- Dados: `useCarregar(funcaoDoService)`; acesso ao Supabase só em `src/services/*.service.ts`.
- Entrada e exibição pt-BR em `src/utils/formato.ts`; erros do banco traduzidos em `src/utils/erros.ts`.

## App do motorista

- Telas em `src/app/motorista/` (Início, Viagens/histórico, Perfil, `viagem/[id]`, `nova-viagem`),
  atrás do `PinPortao` e dentro do `MotoristaProvider` (`src/context/MotoristaContext.tsx`).
- **A tela lê sempre da cópia local** (`src/db/armazem.ts` = SQLite no celular;
  `armazem.web.ts` = localStorage, só para desenvolver no navegador). Nenhuma tela do motorista
  chama o Supabase direto para gravar.
- Toda ação grava no aparelho **e** entra na fila (`armazem.enfileirar`) antes de tentar a rede.
  `enviarFila` (`src/services/motorista.service.ts`) envia na ordem e para no primeiro problema:
  sem conexão → tenta de novo depois; servidor recusou → marca o erro e espera o motorista
  (tentar de novo / descartar). Nunca pular item: a ordem importa (foto do canhoto antes de finalizar).
- Com a fila vazia, `baixarDados` troca a cópia local pelo estado do servidor. Com fila pendente
  não baixa, porque o aparelho está à frente do servidor.
- Operações da fila são idempotentes: `upsert` com `ignoreDuplicates` por UUID gerado no aparelho,
  funções `iniciar_viagem`/`finalizar_viagem`/`criar_viagem_motorista`, upload que trata "já existe" como sucesso.
- Valores da viagem em andamento (frete, comissão, saldo do adiantamento) são recalculados no
  aparelho por `viagemAoVivo`, em centavos inteiros (`src/utils/dinheiro.ts`). O servidor é quem vale.
- Fotos: `src/services/anexo.service.ts` reduz para no máximo 1280 px / JPEG 0,6 e copia para a
  pasta permanente do app. Foto de comprovante vira também um registro em `documentos`.
- O motorista vê frete e a própria comissão; **nunca** combustível, margem ou resultado.
- O envio só acontece com o app aberto (não há tarefa em segundo plano ainda).

## Ambiente

- `.env.local` (fora do git) com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`; modelo em `.env.example`.
- Repositório: `github.com/GilbertoGarbin/frota`, branch `main`.
