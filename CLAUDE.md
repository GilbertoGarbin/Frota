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
- Sem API/servidor separado no MVP.

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

### Autenticação
- Gestor: e-mail + senha (Supabase Auth).
- Motorista: ativação do aparelho com CPF + código gerado pelo gestor; o PIN é só desbloqueio local, não é senha enviada pela rede.

## Ambiente

- `.env.local` (fora do git) com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`; modelo em `.env.example`.
- Repositório: `github.com/GilbertoGarbin/frota`, branch `main`.
