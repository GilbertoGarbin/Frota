# Decisão de Stack e Infraestrutura
## Garbin Transportes · SaaS de Gestão de Micro-Frotas

> Registro das decisões de linguagem, banco de dados, infraestrutura e hospedagem, tomadas a partir de `briefing_tecnico_stack.md` e das duas especificações revisadas. Escopo: **só infra e stack** — modelo de dados, telas e código ficam para as próximas sessões.

---

## 1. Premissas que guiaram as decisões

| Premissa | Valor |
|---|---|
| Quem programa | Claude (assistente de IA), sob direção do dono |
| Plataformas no lançamento | **Web** (gestor) e **Android** (motorista). iOS fica para depois |
| Escala inicial | ~5 transportadoras em teste; cada uma com 2–10 veículos/motoristas |
| Orçamento inicial | **Zero** — apenas planos gratuitos |
| Contas já existentes | Supabase (com outro projeto, o FLUXO), GitHub vinculado à Vercel com deploy automático, domínio próprio já na Vercel |

---

## 2. Decisões

### 2.1 Linguagem — TypeScript, mesma stack do FLUXO
O FLUXO (outro app do mesmo dono, já em produção) foi verificado: **TypeScript + Expo (SDK 56) + Expo Router + React Native Web + Supabase**, com **um único código** que gera o APK Android (EAS) e a versão web (`expo export -p web`) publicada na Vercel. O Frota segue **o mesmo modelo**:

- **Um projeto Expo único** (TypeScript, Expo Router) para Android e web.
- **App do motorista:** telas pensadas para celular, usadas no Android.
- **Painel do gestor:** telas pensadas para desktop, usadas na web. Onde a web precisar de algo mais rico (tabelas densas, filtros, gráficos), usar arquivos específicos de web (`*.web.tsx`, padrão que o FLUXO já usa) com bibliotecas web.
- **Regras compartilhadas** (comissão, adiantamento, totais) escritas uma vez e usadas pelos dois lados.
- **Novidade em relação ao FLUXO:** `expo-sqlite` para o offline do motorista (o FLUXO usa só AsyncStorage).

**Por quê:** stack já dominada e com pipeline funcionando (GitHub → Vercel, EAS → APK); uma linguagem só reduz erro quando a IA programa; React/Expo/Supabase são muito difundidos.

**Ajuste em relação à primeira proposta:** antes estava previsto um monorepo com app Expo + painel web separado em React + Vite. Foi substituído pelo modelo do FLUXO (um código só) para reaproveitar o que já funciona. Se as telas do gestor ficarem limitadas no React Native Web, separar o painel em React + Vite continua sendo a saída.

**Descartados:**
- *PWA para o motorista* — sem garantia de envio em segundo plano quando o sinal volta; offline é crítico na estrada.
- *Flutter* — o Flutter Web é fraco para o painel do gestor, e seria uma stack diferente do FLUXO.
- *Kotlin nativo* — exigiria uma segunda linguagem para a web.

### 2.2 Banco de dados — PostgreSQL (via Supabase)
- **Relacional com transações ACID** — exigido pelo rateio retroativo de combustível (seção 5c da spec do gestor).
- **Multi-tenancy: schema único + `tenant_id` em toda tabela + Row-Level Security (RLS).**
  *Schema por tenant* foi descartado: com muitas contas pequenas, cada migração teria de rodar N vezes.
- **Valores monetários em `numeric(12,2)`** — nunca float.
- **Regras de negócio no banco:** rateio de combustível, recálculo de consumo médio, comissão e conciliação de adiantamento implementados como **funções Postgres** (executam numa transação única), complementadas por **Supabase Edge Functions** quando necessário.
  Não haverá API/servidor separado no MVP — em plano gratuito ele "dormiria" e responderia lento.
- **Rateio baseado em km, não em ordem de chegada** — com offline, um abastecimento pode sincronizar depois de outro mais recente; o recálculo da janela precisa ser determinístico e idempotente.
- **Geolocalização:** gravar lat/long nas paradas desde o início (custo mínimo). A sugestão de paradas começa por texto; PostGIS (disponível no Supabase) entra depois sem migração de dados.

### 2.3 Offline do motorista — fila local ("outbox")
- Lançamentos (abastecimento, despesa, parada, carga extra, documento) gravados primeiro no **SQLite do celular**, com **UUID gerado no aparelho**, e enviados por uma fila quando houver sinal.
- Servidor **idempotente**: reenvio do mesmo UUID nunca duplica.
- Fotos **comprimidas no aparelho** (~300 KB) e enviadas pela mesma fila.
- Não é sincronização completa do banco — o celular baixa só o que o motorista precisa (viagens dele, veículo dele).

### 2.4 Autenticação
- **Gestor:** e-mail + senha (Supabase Auth).
- **Motorista:** vínculo de aparelho + PIN local.
  1. Gestor gera um **código de ativação** no cadastro do motorista.
  2. Motorista ativa o celular uma vez com **CPF + código** → recebe sessão de longa duração.
  3. O **PIN** desbloqueia o app **naquele aparelho** (não é enviado como senha pela internet).
  4. Gestor pode **revogar o aparelho**; motorista inativo perde acesso.

  *Motivo:* PIN de 4–6 dígitos usado sozinho como senha online é vulnerável a tentativa e erro.

### 2.5 Hospedagem e serviços

| Componente | Serviço | Plano |
|---|---|---|
| Banco, Auth, Storage, Edge Functions | **Supabase — projeto novo**, região **São Paulo (sa-east-1)**, separado do FLUXO | Free |
| Versão web (painel do gestor) | **Vercel**, deploy automático a partir do GitHub (mesmo esquema do FLUXO: `expo export -p web`), em **subdomínio** do domínio já existente | Hobby (grátis) |
| Código-fonte | **GitHub** — repositório novo (projeto Expo único, como o FLUXO) | Grátis |
| Build do app Android | **Expo EAS Build** | Free (15 builds Android/mês) |
| Atualizações do app sem reinstalar | **EAS Update** | Free |
| Distribuição Android em teste | **APK instalado direto** nos celulares | Grátis |
| Distribuição Android em produção | Google Play | Taxa única de US$ 25 |

Dados hospedados no Brasil (São Paulo) — favorável à LGPD.

### 2.6 Preço de referência do diesel
Mantido o definido na spec: **preço dos abastecimentos do próprio veículo**. A pesquisa semanal da **ANP** (dados para download, não API em tempo real) fica como referência regional opcional no futuro.

---

## 3. Limites dos planos gratuitos (verificar antes de depender deles)

| Limite | Impacto | Mitigação |
|---|---|---|
| Supabase: projeto **pausa após 7 dias sem uso** | Sistema fora do ar até reativar | Em teste: reativar no painel. Com clientes reais: plano Pro (~US$ 25/mês) |
| Supabase: **sem backup automático** no Free | Risco de perda de dados | Backup semanal (`pg_dump`) via GitHub Actions, gratuito |
| Supabase: **500 MB de banco / 1 GB de arquivos / 5 GB de tráfego por mês** | ~3.000 comprovantes a 300 KB | Suficiente para 5 transportadoras em teste; monitorar |
| Supabase: **2 projetos grátis por organização** | Já há o FLUXO; o Frota usa o segundo | Não sobra vaga para um projeto de homologação separado |
| Vercel Hobby: uso **não comercial** pelos termos | Ao cobrar clientes, migrar para o Pro | Avaliar quando o SaaS começar a faturar |
| EAS: 15 builds Android/mês | Suficiente; correções de JS vão por EAS Update sem build | — |

*Valores consultados em out/2026; esses provedores mudam limites com frequência.*

---

## 4. Quando sair do gratuito (gatilhos)
1. **Primeiro cliente pagante** → Supabase Pro (sem pausa, com backup diário) e Vercel Pro.
2. **Banco perto de 400 MB ou arquivos perto de 800 MB.**
3. **Publicar na Play Store** → conta Google Play (US$ 25, única vez).
4. **iOS** → conta Apple Developer (US$ 99/ano). **Não precisa de Mac**: o EAS compila iOS na nuvem com o mesmo código.

---

## 5. Pendências da spec resolvidas por esta decisão

| Pendência (briefing §8) | Decisão |
|---|---|
| Autenticação do motorista (PIN) | Vínculo de aparelho + PIN local (2.4) |
| Estratégia offline | App nativo (Expo) + fila local SQLite (2.3) |
| Geolocalização das paradas | Gravar lat/long já; matching por texto no MVP, PostGIS depois (2.2) |
| Preço de referência do diesel | Abastecimentos do próprio veículo; ANP opcional (2.6) |
| Multi-tenancy | Schema único + RLS (2.2) |

**Continuam abertas** (de negócio, não de infra): viagem que cruza duas janelas de tanque cheio; continuação × nova viagem no adiantamento; limites do farol de margem; número de janelas da média móvel.

---

## 6. Próximos passos (fora do escopo desta sessão)
1. Criar o projeto Supabase (São Paulo) e o repositório no GitHub ligado à Vercel.
2. Modelo de dados + políticas RLS + funções de rateio.
3. Estrutura do projeto Expo (telas do motorista / telas do gestor / regras compartilhadas / banco), partindo da organização do FLUXO.
