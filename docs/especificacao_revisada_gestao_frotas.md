# Painel do Gestor — Especificação Revisada (Handoff)
### Garbin Transportes · SaaS de Gestão de Micro-Frotas

Este documento complementa `especificacao_ui_ux_gestao_frotas.md` (documento original) e `especificacao_revisada_app_motorista.md` (revisão da área do motorista). Ele cobre a revisão das **Telas 2 a 6** (lado do gestor) e adiciona uma tela nova (Motoristas) que faltava no mapeamento original.

## 1. Como esta revisão foi feita — diferença em relação à do motorista

A revisão do motorista partiu da comparação entre a especificação e uma tela real já implementada, o que revelou problemas concretos (contraste, hierarquia, campos redundantes). **Não temos ainda telas reais implementadas do lado do gestor** — havia um pacote de protótipos mais antigo (`App para transportadoras (4).zip`), mas ele pertence a uma exploração de produto diferente (paleta `#2f6bb3`, modelo de carga lotação com fiscal por integração e rastreador embarcado) que não é a linha ativa, e foi descartado como referência a pedido do dono.

Por isso, esta revisão é baseada em três coisas: (1) aplicar a mesma paleta e os mesmos princípios já validados no app do motorista, para as duas pontas do sistema parecerem um produto só; (2) resolver as pendências de negócio que ficaram em aberto na revisão do motorista (cadastro de motorista, lançamento de diária/pedágio/reentrega, definição do adiantamento, transparência do resultado operacional); (3) apontar onde ainda falta uma comparação com tela real — recomendo repetir, quando houver protótipo navegável do gestor, o mesmo exercício de "comparar com a tela real" feito no motorista.

---

## 2. Princípios aplicados (herdados do app do motorista + específicos do desktop)

- **Mesma paleta, mesmos tokens.** Nenhuma cor nova é introduzida sem necessidade — ver seção 3.
- **Cor nunca sozinha.** Alertas e badges usam ícone + cor, nunca só cor.
- **Contraste testado, não assumido.** Nenhum texto branco sobre fundo saturado sem checar WCAG AA — isso invalida o "card verde sólido" do documento original (ver seção 3).
- **Campos derivados são visualmente diferentes de campos editáveis.** Vale também no gestor: comissão calculada, resultado operacional, adiantamento sugerido — nenhum desses tem cara de input quando não é editável naquela tela.
- **Densidade alta, mas sem densidade solta.** O gestor passa o dia na tela — tabelas com zebra-striping, filtros no topo, e ações em lote onde fizer sentido, mas sempre com espaçamento generoso o bastante para não cansar a vista (o documento original já pedia isso).
- **Um caminho por decisão de negócio.** Se um valor pode ser lançado tanto pelo motorista quanto pelo gestor (caso da carga complementar × dos lançamentos do gestor), a tela deixa claro **quem lançou o quê** — nunca dois formulários que fazem a mesma coisa sem identificação de origem.

---

## 3. Paleta e uso (mesma tabela da revisão do motorista — reaplicada aqui)

| Token | Hex | Uso no gestor | Observação |
|---|---|---|---|
| Primary / Ação | `#0066FF` | Botões primários, links da sidebar ativos, ícones de ação | — |
| Primary dark (texto sobre chip claro) | `#0C447C` | Texto sobre fundo `#EFF6FF` | — |
| Success | `#00B87C` | Usado só em texto/ícone, nunca como fundo sólido com texto branco em cima | Corrige o "Card Verde suave" do documento original — ver abaixo |
| Success bg claro / texto | `#E3F7EF` / `#00694A` | Fundo do card "Resultado Líquido (Lucro)" na Tela 2, badges de margem saudável na Tela 6 | Novo — substitui o verde saturado por um chip claro, mesmo padrão do chip azul do motorista |
| Warning bg / texto | `#FAEEDA` / `#633806` | Badge "Em andamento", alertas de manutenção/CNH/pneu na Tela 2 | Igual ao motorista |
| Danger bg / texto | `#FCEBEB` / `#791F1F` | Badge de margem baixa (Tela 6), alerta de documento vencido | Igual ao motorista |
| Danger (botão) | `#A32D2D` | Ações destrutivas (ex.: desativar motorista) | Igual ao motorista |
| Neutral Dark | `#1E293B` | Sidebar, headers, texto principal | Igual ao original |
| Background | `#F8FAFC` | Fundo geral | Igual ao original |
| Border | `#E2E8F0` | Bordas de cards, tabelas e inputs | Igual ao original |
| Chip claro | `#EFF6FF` | Fundo de valores calculados (comissão, resultado operacional, adiantamento sugerido) | Igual ao motorista |

**Ajuste concreto na Tela 2:** o card "Resultado Líquido (Lucro): R$ 10.060,02" do documento original usava fundo verde saturado — vira fundo `#E3F7EF` com texto `#00694A` e o valor em negrito, mesmo tratamento do chip de comissão do motorista.

---

## 4. Arquitetura de navegação (gestor)

```
Sidebar: Visão Geral · Viagens · Veículos & Pneus · Motoristas (novo) · Manutenções · Custos Fixos · Financeiro/Fechamento

Visão Geral (Tela 2)
  └─ Clique em item de alerta ──> leva direto à tela/registro relacionado
       (veículo → Manutenções; CNH → Motoristas; pneu → Veículos & Pneus)

Viagens (Tela 4)
  ├─ [+ Nova viagem] ──> Formulário de despacho (motorista, veículo, cliente, rota, carga,
  │                       frete, adiantamento sugerido/ajustável) ──> Salva como "programada"
  │                       ──> aparece em "Próximas viagens" no Início do motorista atribuído
  │                       ──> motorista faz "Confirmar viagem" (informando Km inicial) e inicia
  │
  └─ Clique em card de viagem existente ──> Detalhe da viagem (expande o card ou abre painel)
        ├─ Bloco Adiantamento (sugerido/ajustável)
        ├─ Bloco "Lançamentos do gestor" (+ Lançar valor adicional)
        │     └─ Diária de espera / Pedágio adicional / Reentrega / Outro
        └─ Bloco Prestação de contas do adiantamento (só leitura, viagem finalizada)
              └─ [Marcar como acertado]

Motoristas (Tela 7, nova)
  ├─ Lista de motoristas ──> [+ Novo motorista] ──> Formulário de cadastro
  └─ [Editar] em um motorista ──> mesmo formulário, preenchido
```

**Decisão fechada com o dono:** o fluxo normal de uma transportadora é o **gestor criar a viagem e atribuir a um motorista** — não o motorista se autocadastrar. Por isso a Tela 4 ganha um botão `+ Nova viagem` (ver seção 6.3). O formulário `Cadastrar viagem` que já existe no app do motorista (seção 5.3 do documento do motorista) continua existindo porque, numa frota de até 10 caminhões, é comum o próprio motorista **ser** o dono/gestor — nesse caso a mesma pessoa usa os dois lados do sistema, com chapéus diferentes. Não é o fluxo principal; é o caminho para quando não existe separação de papéis.

```
Fluxo principal:              Gestor cria a viagem (Tela 4) → atribui a um motorista
                                        │
                                        v
                    Motorista vê em "Próximas viagens" (Início) → Confirmar viagem → inicia

Fluxo alternativo (motorista = gestor, frota pequena):
                    Motorista cria a própria viagem direto no app dele (Cadastrar viagem) → inicia
```

---

## 5. Regra transversal — adiantamento, lançamentos do gestor e apuração de combustível

Estas regras nascem de decisões tomadas nesta sessão e afetam a Tela 4 inteira, então documento aqui antes de entrar tela por tela.

**a) Adiantamento sugerido por rota, ajustável pelo gestor**
O sistema calcula automaticamente um valor sugerido de adiantamento com base na **média dos adiantamentos de viagens já finalizadas na mesma rota** (mesma combinação origem/destino). O gestor pode ajustar esse valor livremente antes de a viagem ser liberada; o motorista **não** define esse valor (ver ajuste já aplicado em `especificacao_revisada_app_motorista.md`, seções 5.0b e 5.3). Se a rota é nova (sem viagens anteriores), não há sugestão — o campo aparece vazio com a instrução "Sem histórico nesta rota — defina o valor manualmente."

**b) Lançamentos do gestor (diária de espera, pedágio adicional, reentrega)**
Diferente da carga complementar (que só o motorista lança, por ter a informação de campo), estes três tipos de valor normalmente são negociados entre a transportadora e o cliente/embarcador — por isso quem lança é o **gestor**, na tela de detalhe da viagem. Cada lançamento:
- Tem um tipo (`Diária de espera` / `Pedágio adicional` / `Reentrega` / `Outro`), valor, data e observação opcional.
- Soma ao `valor_frete_total` da viagem, exatamente como a carga complementar do motorista — e por consequência recalcula a comissão do motorista automaticamente (quando comissionado).
- Fica marcado com `origem_lancamento = gestor` no registro (mesma entidade `Complemento` usada pela carga complementar do motorista, que tem `origem_lancamento = motorista`) — assim a tela de detalhe da viagem consegue listar tudo junto, mas com uma etiqueta de origem em cada item.
- Pode ser editado ou removido pelo gestor enquanto a viagem não estiver finalizada.

**c) Apuração de combustível por viagem (estimado → apurado)**
**Problema de origem:** numa frota com fretes curtos (ex.: 200 km ida e volta), o motorista nem sempre abastece ao final de cada viagem — o tanque ainda tem fôlego para o frete seguinte. Se o combustível da viagem fosse simplesmente "o que foi abastecido durante ela", duas coisas dariam errado: viagens sem abastecimento apareceriam com combustível `R$ 0,00` (margem parece ótima, mas é ilusão), e quando o motorista finalmente abastece, aquele valor cairia inteiro em cima de uma única viagem (margem daquela viagem despencaria artificialmente).

**Decisão fechada com o dono:** todo veículo passa a ter um **consumo médio (km/L)**, calculado a partir dos abastecimentos marcados como **"tanque cheio"** (esse campo já existe no app do motorista — ver `especificacao_revisada_app_motorista.md`, seção 5.9). O cálculo funciona em duas fases:

1. **Estimativa imediata** — assim que uma viagem finaliza (tem `km_final` preenchido), o sistema calcula um combustível **estimado**: `km rodado da viagem ÷ consumo médio do veículo × preço médio recente do litro`. Esse valor aparece na Tela 4 com um selo **"Estimado"**.
2. **Apuração real (retroativa)** — quando o motorista faz um abastecimento com **tanque cheio**, o sistema define uma "janela de consumo": o intervalo de km entre esse abastecimento e o tanque-cheio anterior do mesmo veículo. Ele soma tudo que foi realmente gasto nessa janela (o tanque cheio final + qualquer abastecimento parcial no meio do caminho) e **reparte esse valor real entre as viagens finalizadas dentro da janela, proporcional ao km rodado de cada uma**. O selo dessas viagens muda de "Estimado" para **"Apurado"**, e o valor exibido passa a ser o real (rateado), não mais a estimativa. O mesmo fechamento também recalcula o consumo médio do veículo (km da janela ÷ litros do tanque cheio), que passa a valer para as próximas estimativas — uma média móvel das últimas 5 janelas fechadas evita que um evento fora do padrão (ex.: um desvio de rota) distorça a estimativa seguinte.

**Onde isso aparece:** só do lado do gestor (Tela 4 e Tela 6) — o motorista comissionado não vê combustível de qualquer forma (ver seção 5.0a de `especificacao_revisada_app_motorista.md`), então essa complexidade fica invisível para ele. Nenhuma tela nova do motorista precisa mudar; o checkbox "tanque cheio" que já existe passa a ter esse uso adicional.

**Primeira janela de um veículo novo:** sem nenhum tanque-cheio registrado ainda, não há consumo médio calculado. O cadastro do veículo (ver ajuste na Tela 3, seção 6.2) ganha um campo `Consumo médio estimado (km/L)` que o gestor preenche manualmente ao cadastrar o veículo — o sistema usa esse valor até que o primeiro fechamento real de tanque cheio aconteça e passe a calcular sozinho.

---

## 6. Telas e campos

### 6.1 Tela 2 — Dashboard / Visão Geral

Mantém a estrutura do documento original, com estes ajustes:

- **Sidebar:** mesmos links do original (`Visão Geral`, `Viagens`, `Veículos & Pneus`, `Manutenções`, `Custos Fixos`, `Financeiro/Fechamento`) **+ `Motoristas`** (o link já existia na especificação original, mas nenhuma tela foi desenhada para ele até agora — ver Tela 7).
- **Header com filtro de período:** sem alteração.
- **Grade de 4 KPIs** (Faturamento Bruto, Custos Operacionais, Custos Fixos, Resultado Líquido): mesma estrutura; o card de Resultado Líquido usa o chip verde claro (ver seção 3) em vez do verde sólido.
- **Seção de Alertas "Atenção Necessária":** mantém o padrão de card com borda amarela e ícone ⚠️ por item; cada item passa a ser **clicável**, levando direto ao registro relacionado (troca de óleo → Manutenções; CNH vencendo → Motoristas; pneu → Veículos & Pneus). Hoje esses alertas eram só texto estático.
- **Grid de módulos rápido:** sem alteração de conteúdo, só de estilo (aplicar sombra suave e cores do design system revisado).

### 6.2 Tela 3 — Controle Visual de Pneus e Eixos

**Mantida como no documento original nesta revisão.** Esta tela precisa de validação de campo com motoristas e donos de frota antes de receber o mesmo nível de detalhamento das demais — investir em refinar layout, cores e interação agora seria retrabalho se a validação mudar a abordagem (por exemplo, se o desenho vetorial do chassi não for a melhor forma de representar os eixos na prática). Quando a validação acontecer, revisitar esta tela com o mesmo processo aplicado às demais.

**Adição pontual — dados básicos do veículo:** o documento original nunca teve uma tela própria de cadastro de veículo (só um seletor de placas, como se os veículos já existissem prontos). Esta tela ganha uma pequena seção de dados do veículo, separada do mapa de pneus (que segue como placeholder):
| Campo | Tipo | Observação |
|---|---|---|
| Placa | Texto | — |
| Modelo | Texto | — |
| Km atual | Numérico | Atualizado a cada finalização de viagem |
| Status | Select | Ativo / Em manutenção / Inativo |
| Consumo médio estimado (km/L) | Numérico | Valor inicial que o gestor informa manualmente; o sistema passa a calcular sozinho a partir do primeiro fechamento de tanque cheio (ver seção 5c) e sobrescreve esse valor — o gestor pode ajustar manualmente a qualquer momento |

### 6.3 Tela 4 — Gestão de Viagens e DRE por Rota

Mantém filtros e lista de cards do documento original (busca por placa/motorista/destino, status). Ganha um botão em destaque `+ Nova viagem` no header da tela — este é o **fluxo principal** de criação de viagem (ver seção 4).

**Formulário de Nova viagem (despacho):**
| Campo | Tipo | Observação |
|---|---|---|
| Motorista | Select | Lista de motoristas ativos (Tela 7); ao escolher, sugere automaticamente o veículo vinculado a ele |
| Veículo | Select | Pré-preenchido pelo motorista escolhido; pode ser trocado |
| Cliente / embarcador | Select ou texto | Opcional |
| Origem | Texto | — |
| Destino | Texto | — |
| Carga | Texto | Opcional |
| Data prevista | Date | — |
| Valor do frete (R$) | Numérico | — |
| Adiantamento | Chip com valor sugerido (ver seção 5a) + campo editável | Já aparece calculado na criação, não só depois — o gestor pode ajustar antes de salvar |

Ação: `Salvar e atribuir` — cria a viagem com status `programada` e ela passa a aparecer em "Próximas viagens" no Início do motorista escolhido. **`Km inicial` não é preenchido aqui** — só existe quando o veículo realmente sai, então esse dado passa a ser capturado pelo motorista no momento de confirmar/iniciar a viagem (ajuste correspondente em `especificacao_revisada_app_motorista.md`, seção 5.2).

Com estas adições no **detalhe de cada viagem já existente**:

**Corpo do card (grid de valores):**
`Frete Bruto` · `Combustível` · `Comissão Motorista` · `Outras Despesas` · `Margem Operacional` (destaque, verde claro se ≥ 30%, vermelho claro se < 10% — ver farol da Tela 6).

**Novo — selo no valor de Combustível:** um pequeno selo ao lado do valor indica `Estimado` (neutro/cinza) ou `Apurado` (verde) — ver a lógica completa na seção 5c. Ao tocar no selo "Estimado", uma dica explica: "Calculado por km rodado × consumo médio do veículo. Será corrigido quando o motorista reabastecer com tanque cheio."; no "Apurado": "Valor real, rateado a partir do abastecimento de [data]."

Quando a viagem tem lançamentos do gestor ou carga complementar, o `Frete Bruto` mostra uma nota curta: "Inclui R$ 320,00 de diária de espera e R$ 800,00 de carga complementar" — nunca esconder a composição do valor (mesmo princípio já aplicado na Conferência Final do motorista).

**Ao expandir / abrir detalhe da viagem, três blocos novos:**

1. **Adiantamento**
   | Campo | Tipo | Observação |
   |---|---|---|
   | Valor sugerido | Somente leitura, chip claro | "Sugerido: R$ 350,00 (média de 4 viagens em Curitiba → Pato Branco)" — ou "Sem histórico nesta rota" |
   | Valor definido | Numérico, editável pelo gestor | Se alterado depois que o motorista já confirmou a viagem, o valor atualiza também no app dele |

2. **Lançamentos do gestor** — botão `+ Lançar valor adicional`, abre mini-formulário:
   | Campo | Tipo | Observação |
   |---|---|---|
   | Tipo | Segmentado | `Diária de espera` / `Pedágio adicional` / `Reentrega` / `Outro` |
   | Valor (R$) | Numérico | Soma ao frete total da viagem |
   | Data | Date | — |
   | Observação | Texto curto | Opcional |

   Lista abaixo do formulário: todos os lançamentos da viagem (do motorista e do gestor), cada um com etiqueta de origem (`Lançado pelo motorista` / `Lançado pela gestão`), valor, data e ação de editar/remover (só permitida antes da viagem finalizar).

3. **Prestação de contas do adiantamento** (somente leitura — só aparece quando a viagem está finalizada e teve adiantamento)
   `Adiantamento` · `Gasto pelo motorista` · `Saldo` (rótulo "a devolver pelo motorista" ou "a reembolsar ao motorista", mesmo espelho do painel do motorista). Botão `[Marcar como acertado]` — registra que o valor trocou de mãos fisicamente; vira um badge "Acertado em [data]" depois de confirmado.

Ações existentes mantidas: `[Ver Comprovantes/Anexos]`, `[Detalhar Lançamentos]`.

### 6.4 Tela 5 — Módulo de Manutenções e Preventivas

Mantém a estrutura do documento original (banner de resumo, modal de cadastro, histórico em tabela). Ajustes de consistência:
- Badges de status do pagamento (Pago/Pendente) usam os tokens de Success/Warning em fundo claro, não cor sólida.
- Banner "0 Vencidas · 2 Próximas" usa ícone + cor (não só cor) para o indicador de vencidas.

### 6.5 Tela 6 — Financeiro e Fechamento Mensal (DRE Consolidado)

Mantém a estrutura do documento original (blocos DRE executivo, CPK, tabela comparativa por placa com farol). Ajustes:
- **Farol da tabela comparativa:** troca o indicador sólido verde/vermelho por badge de fundo claro (`#E3F7EF`/`#00694A` para margem ≥ 30%, `#FCEBEB`/`#791F1F` para margem < 10%) — mesmo princípio de contraste aplicado em todo o resto do sistema.
- **Novo bloco: "Adiantamentos em aberto"** — total de saldo ainda não acertado no período (soma dos saldos de todas as viagens finalizadas com adiantamento e sem o `[Marcar como acertado]` da Tela 4), com link que leva direto à Tela 4 já filtrada por essa condição.
- **Combustível consolidado por placa (coluna da tabela comparativa) usa os valores já apurados quando existem, e estimados quando a janela ainda está aberta** — ver seção 5c. Uma nota no rodapé da tabela avisa quando alguma placa ainda tem viagens com combustível "estimado" no período: "Valores de combustível de N viagem(ns) ainda estimados — serão corrigidos no próximo abastecimento com tanque cheio."

### 6.6 Tela 7 (nova) — Motoristas: Cadastro e Edição

**Contexto e objetivo:** esta tela não existia no documento original, mas o link "Motoristas" já estava previsto na sidebar (Tela 2). É daqui que vêm os campos `comissao_percentual` e `modelo_remuneracao` usados em toda a área do motorista.

**Lista de motoristas (tabela):**
`Nome` · `Veículo vinculado` · `Modelo de remuneração` (badge: Comissionado/Assalariado) · `% Comissão` (só exibida quando comissionado) · `CNH — validade` (badge de alerta se vencer em menos de 30 dias) · `Status` (Ativo/Inativo) · ação `[Editar]`.

Botão em destaque: `+ Novo motorista`.

**Formulário de cadastro/edição:**
| Campo | Tipo | Observação |
|---|---|---|
| Nome completo | Texto | — |
| CPF | Texto com máscara | — |
| Telefone | Texto com máscara | — |
| CNH — número | Texto | — |
| CNH — validade | Date | Alimenta o alerta da Tela 2 e da própria lista |
| Veículo vinculado | Select | Lista de veículos da frota |
| Modelo de remuneração | Segmentado: `Comissionado` / `Assalariado` | Controla os campos seguintes e toda a exibição financeira no app do motorista (ver `especificacao_revisada_app_motorista.md`, seção 5.0a) |
| % Comissão | Numérico | Aparece só se `Comissionado` |
| Salário fixo (R$) | Numérico, opcional | Aparece só se `Assalariado`; reservado para uma futura tela de folha de pagamento — não é usado em nenhum cálculo hoje |
| Acesso ao app | Botão `[Gerar/redefinir PIN de acesso]` | O fluxo de login do motorista (CPF + PIN, sessão por dispositivo) ainda não foi decidido nesta revisão — ver pendências |
| Status | Toggle Ativo/Inativo | Motorista inativo perde acesso ao app |

**Sobre a transparência do resultado operacional:** essa não é uma opção configurável por motorista — é uma regra fixa do sistema (todo motorista comissionado vê frete total + sua comissão, nunca o resultado operacional/margem), por isso não há campo relacionado a isso neste formulário.

---

## 7. Entidades e campos — atualizações sobre o rascunho do documento do motorista

**Motorista** (campos novos em relação ao rascunho anterior)
`cpf`, `telefone`, `cnh_numero`, `status` (`ativo` / `inativo`), `pin_acesso` (referência — fluxo de autenticação ainda não decidido), `salario_fixo` (opcional, só relevante quando `modelo_remuneracao = assalariado`, não usado em cálculo ainda)

**Complemento** (uso confirmado do campo `origem_lancamento`)
Mesma entidade já rascunhada no documento do motorista — agora com os dois valores de `origem_lancamento` em uso: `motorista` (carga complementar) e `gestor` (diária de espera / pedágio adicional / reentrega / outro, via Tela 4). Campo `tipo` passa a fazer sentido para lançamentos de gestor: `carga_complementar` / `diaria_espera` / `pedagio_adicional` / `reentrega` / `outro`.

**Viagem** (campos novos)
`adiantamento_sugerido` (derivado — média de `valor_adiantamento` de viagens finalizadas com mesma `origem`+`destino`), `adiantamento_acertado` (bool — true depois que o gestor clica em "Marcar como acertado" na prestação de contas), `combustivel_status` (`estimado` / `apurado` — ver seção 5c), `combustivel_valor` (deixa de ser "soma de abastecimentos vinculados à viagem" e passa a ser a estimativa por km ou o valor real rateado, conforme `combustivel_status`)

**Veiculo** (campos novos em relação ao rascunho anterior)
`consumo_medio_km_por_litro` (numérico — informado manualmente no cadastro como valor inicial; recalculado automaticamente a cada fechamento de tanque cheio, média móvel das últimas 5 janelas — ver seção 5c), `preco_medio_referencia_combustivel` (derivado — preço por litro do abastecimento mais recente do veículo, usado na estimativa antes do primeiro fechamento de tanque cheio)

**Abastecimento** (uso confirmado do campo `tanque_cheio`)
Mesma entidade já rascunhada no documento do motorista — o campo `tanque_cheio` (já existente, capturado no app do motorista) passa a ser o âncora que fecha uma "janela de consumo" e dispara o rateio retroativo de combustível entre as viagens daquele intervalo (ver seção 5c). Não é uma tabela nova nem um campo novo — só um uso adicional de um campo que já existia.

---

## 8. Pendências (fora do escopo desta revisão)

- **Fluxo de login do motorista** (CPF + PIN, sessão por dispositivo, encerramento remoto) — mencionado no cadastro (botão de gerar/redefinir PIN) mas o fluxo completo de autenticação não foi desenhado nesta revisão nem na do motorista.
- **Mapa de pneus (Tela 3)** — segue como placeholder; precisa da validação de campo já mencionada antes de qualquer redesenho.
- **Modo escuro e comportamento offline no desktop** — o documento original cita modo escuro como diretriz geral; sem paleta própria definida também para o lado do gestor.
- **Salário fixo do motorista assalariado** — campo reservado no cadastro, mas nenhuma tela de folha de pagamento foi desenhada; fica para uma fase futura.
- **Regra de exibição do farol de margem (Tela 6)** — os limites usados (`≥ 30%` verde, `< 10%` vermelho) vêm do documento original; vale confirmar com o dono se esses cortes ainda fazem sentido com o modelo de carga lotação e comissão atual.
- **Preço de referência do diesel para a estimativa de combustível** (seção 5c) — hoje usa o preço do abastecimento mais recente do próprio veículo; se a frota crescer ou os preços variarem muito por posto/região, pode valer a pena um preço de referência mais robusto (ex.: média móvel regional).
- **Número de janelas usado na média móvel de consumo (km/L)** — a spec sugere as últimas 5 janelas fechadas como ponto de partida; é um número ajustável, sem base em dado real do negócio ainda.
- **O que fazer se uma viagem cruza duas janelas de consumo** (o motorista abastece com tanque cheio no meio de uma viagem longa) — o modelo desta revisão assume que o fechamento de janela acontece **entre** viagens, não no meio de uma. Viagens de vários dias com abastecimento tanque-cheio no meio ficam como caso não coberto.

---

## 9. Arquivos entregues junto com este documento

- `especificacao_revisada_gestao_frotas.md` — este documento.
- Ajustes aplicados em `especificacao_revisada_app_motorista.md` (seções 5.0a, 5.0b, 5.3, 5.11 e 7) para refletir as decisões tomadas nesta sessão sobre adiantamento e transparência do resultado operacional — nenhum arquivo novo foi criado para isso, o documento existente foi atualizado.
- Ainda não existe um protótipo HTML navegável para o lado do gestor (equivalente ao `prototipo_motorista.html`) — é um próximo passo natural, mas não foi pedido nesta sessão.
