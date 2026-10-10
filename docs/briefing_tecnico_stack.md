# Briefing Técnico — Pesquisa de Stack, Banco e Infra
## Garbin Transportes · SaaS de Gestão de Micro-Frotas

> Este documento é um resumo enxuto, focado em arquitetura/infra, para uma sessão que vai pesquisar linguagens, banco de dados e infraestrutura. As especificações completas de UI/UX (telas, campos, fluxos) estão nos outros arquivos listados no final — leia-as se precisar de detalhe fino de algum campo ou tela.

---

## 1. O que é o produto

SaaS para donos de **micro-frotas** (tipicamente 2 a 10 caminhões por cliente/transportadora) gerenciarem viagens, motoristas, veículos, combustível, despesas e resultado financeiro. Dois lados de uso dentro de cada conta:

- **App do Motorista** (mobile): confirma viagens, lança abastecimento/despesas/paradas/cargas complementares, anexa documentos, acompanha adiantamento.
- **Painel do Gestor** (web/desktop): cadastra viagens e motoristas, acompanha margem por viagem, apura combustível, fecha financeiro.

## 2. Multi-tenancy

Cada transportadora é um **tenant** isolado. Dentro de um tenant: N motoristas, N veículos, N viagens — mas **todos pequenos em volume** (ver seção 6). A arquitetura precisa escalar em **número de contas**, não em volume por conta. Decisão a pesquisar: schema por tenant vs. row-level security em schema único.

## 3. Perfis de uso e dispositivo

- **Motorista**: celular, muitas vezes na estrada com sinal instável. Precisa de câmera (captura de comprovantes/documentos). Comportamento offline ainda **não definido** — é uma pendência explícita que a pesquisa de stack deveria ajudar a resolver (PWA com cache local? app nativo? sincronização posterior?).
- **Gestor**: desktop/notebook, conexão estável, uso administrativo/analítico (tabelas, filtros, dashboards).

## 4. Núcleo de entidades (resumo)

| Entidade | Campos-chave | Observação |
|---|---|---|
| Motorista | `modelo_remuneracao` (comissionado/assalariado), `comissao_percentual`, `salario_fixo`, `cnh_validade`, `pin_acesso` | Dois modelos de remuneração coexistem |
| Veiculo | `consumo_medio_km_por_litro`, `preco_medio_referencia_combustivel`, `ultimo_km_tanque_cheio` | Consumo médio é recalculado (média móvel) |
| Viagem | rota, `km_inicial`/`km_final`, `valor_frete_total`, `adiantamento_sugerido`/`definido`/`acertado`, `combustivel_status` (estimado/apurado), `combustivel_valor` | Entidade central, muitos campos derivados |
| Abastecimento | valor, litros, `tanque_cheio` (bool), `forma_pagamento` | `tanque_cheio=true` dispara recálculo de consumo + rateio |
| Despesa | valor, `forma_pagamento` (adiantamento/cartão empresa/próprio bolso) | |
| Complemento | `origem_lancamento` (motorista/gestor), `tipo` | Soma ao frete total e à base de comissão |
| Parada | `tipo`, local, lat/long (opcional), `avaliacao_estrelas`, comentário | Base para sugestão futura de paradas |
| Documento | arquivo, tipo, viagem_id | Upload de imagem/PDF |

Campos completos e regras de cada tela: ver `especificacao_revisada_app_motorista.md` (seção 6) e `especificacao_revisada_gestao_frotas.md` (seção 7).

## 5. Lógica de negócio não-trivial (impacta decisão de arquitetura)

1. **Apuração de combustível (estimado → apurado)** — a mais complexa. Ao registrar um "tanque cheio": recalcula o consumo médio do veículo (média móvel das últimas 5 janelas) **e** faz rateio retroativo do custo real entre **todas** as viagens daquela janela de consumo, proporcional ao km rodado, atualizando o status de cada viagem envolvida de uma vez. Isso é uma operação transacional multi-registro — pede banco relacional com transações ACID (não um modelo eventualmente consistente).
2. **Adiantamento**: sugestão por média histórica de rotas → ajuste manual do gestor → acompanhamento de gasto em tempo real durante a viagem → conciliação final (saldo a devolver/reembolsar).
3. **Comissão**: percentual sobre frete total (base + complementos + lançamentos do gestor) — cálculo simples, mas depende de soma de itens relacionados (não é um valor armazenado isoladamente).
4. **Sugestão de paradas por local** (futuro): ainda indefinido se será correspondência por texto ou por lat/long — se for geo, implica índice espacial (ex.: PostGIS).

## 6. Escala

- Por tenant: baixo volume — poucas dezenas de viagens/mês, 2-10 veículos, 2-10 motoristas.
- Multiplicado por N tenants (clientes do SaaS) — a pesquisar quantos tenants são esperados em 1-2 anos, mas nada indica necessidade de big data ou processamento massivo. É um problema de **modelagem relacional bem feita + multi-tenancy**, não de escala bruta.

## 7. Requisitos não funcionais identificados até aqui

- Multi-tenancy com isolamento de dados entre transportadoras
- Upload e armazenamento durável de imagens/documentos (comprovantes, canhotos) — storage tipo objeto (S3-like)
- Precisão decimal em cálculos financeiros (nunca float puro)
- Processo transacional/em lote para o rateio de combustível
- Mobile com acesso à câmera; estratégia offline em aberto
- Painel web responsivo, desktop-first para o gestor

## 8. Pendências que a pesquisa de stack deveria ajudar a resolver

- Autenticação simplificada do motorista (PIN em vez de senha tradicional?) e como isso se reflete em sessão/segurança
- Estratégia offline do app do motorista (PWA com cache local vs. nativo vs. apenas sinalizar indisponibilidade)
- Geolocalização para sugestão de paradas (texto simples vs. lat/long com índice espacial)
- Fonte do preço de referência do diesel (API externa de preço de combustível vs. input manual pelo gestor)
- Esquema de multi-tenancy (schema por tenant vs. RLS em schema compartilhado) considerando o volume baixo por tenant

## 9. Decisão de layout já fechada (não afeta stack, mas documenta o estado do projeto)

O painel do gestor segue com o layout original — **sidebar fixa escura** (`prototipo_gestor.html`), não a variante clara colapsável testada em paralelo (`prototipo_gestor_v2.html`, descartada).

## 10. Arquivos para levar para a sessão de arquitetura

- `briefing_tecnico_stack.md` (este arquivo)
- `especificacao_revisada_app_motorista.md`
- `especificacao_revisada_gestao_frotas.md`
- `prototipo_motorista.html`
- `prototipo_gestor.html` (layout escolhido — v1)
