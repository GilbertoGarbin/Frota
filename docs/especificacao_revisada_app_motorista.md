# App do Motorista — Especificação Revisada (Handoff)
### Garbin Transportes · SaaS de Gestão de Micro-Frotas

Este documento complementa `especificacao_ui_ux_gestao_frotas.md` (documento original). Ele registra o que foi revisado durante uma sessão de design que partiu de telas reais já implementadas, comparou com a especificação original e chegou a decisões concretas de layout, hierarquia, campos e regras de negócio para a área do motorista.

Use este documento como ponto de partida para desenhar as telas visualmente e para modelar as tabelas/campos do banco de dados. Ele não substitui o documento original — cobre em detalhe apenas a **área do motorista**. As telas do gestor (Dashboard, Pneus, Viagens/DRE, Manutenções, Financeiro) continuam válidas como estão no documento original e **não foram revisadas** nesta sessão.

---

## 1. Diagnóstico do que existia

Ao comparar o app real com a especificação original, os principais problemas encontrados foram:

1. **Contraste quebrado.** O card verde do motorista (`#00B87C` com texto branco) deixa "Comissão atual: 14,00%" praticamente ilegível — o verde é escuro/saturado demais para texto branco em cima passar no mínimo de acessibilidade (WCAG AA, 4,5:1). O azul da marca (`#0066FF`) passa nesse teste (~4,8:1) e foi adotado no lugar.
2. **Hierarquia invertida.** Antes de chegar no botão de ação (iniciar viagem), o motorista rolava por: header grande, aviso fixo de "uso operacional", card de comissão, 4 mini-cards de veículo. Isso contraria o princípio do próprio documento original ("simplicidade radical, mínimo de cliques").
3. **Ícones inconsistentes.** Mistura de ícones ilustrativos coloridos (ex.: bomba de combustível vermelha) com ícones de traço monocromático — quebra a sensação de sistema único.
4. **Estados vazios redundantes.** Múltiplos indicadores repetindo "zero" (ex.: "0 registros" + "0,00 L · R$ 0,00" + caixa de texto "nenhum registro") em vez de uma mensagem só.
5. **Campo de comissão editável na aparência.** O campo "Comissão calculada" no formulário de viagem tinha a mesma cara de um input, mas é um valor derivado (não deveria ser editável nunca).
6. **Upload de arquivo no controle nativo do navegador.** O botão "Escolher Arquivo" do HTML padrão quebra a identidade visual do resto do app, e não aproveita a câmera do celular.
7. **Duas portas para o mesmo lugar.** Ícone de histórico no header e item "Viagens" na bottom nav apontavam (ou podiam apontar) para conceitos diferentes — foi definido que ambos devem levar à mesma tela de histórico.

---

## 2. Princípios aplicados nesta revisão

- **Hero no topo:** a ação mais provável (iniciar/continuar viagem) fica visível sem rolar a tela.
- **Cor nunca sozinha:** todo indicador de status (pendência, alerta, "em andamento") usa ícone + cor, nunca só cor — importante para usuários com daltonismo.
- **Contraste testado, não assumido:** qualquer texto sobre fundo colorido foi verificado contra o mínimo de acessibilidade antes de aprovar a combinação.
- **Divulgação progressiva:** informação de detalhe (ex.: quebra "pago pela empresa / pago pelo motorista") só aparece quando já existe dado — não antes.
- **Campos derivados são visualmente diferentes de campos editáveis:** valores calculados (comissão, total do abastecimento) ficam em um bloco com estilo de "resultado", nunca com aparência de input.
- **Câmera nativa em vez de input de arquivo genérico:** qualquer anexo (comprovante de despesa, abastecimento, documento) oferece "Tirar foto" como ação primária.
- **Um caminho por destino:** se duas entradas de navegação levam ao mesmo conteúdo, elas devem apontar para a mesma tela — nunca duplicar telas parecidas.

---

## 3. Paleta e uso (ajustada)

| Token | Hex | Uso | Observação |
|---|---|---|---|
| Primary / Ação | `#0066FF` | Botões primários, ícones de ação, card de destaque do motorista | Substitui o verde no card de topo por causa do contraste |
| Primary dark (texto sobre chip claro) | `#0C447C` | Texto sobre fundo `#EFF6FF` | — |
| Success | `#00B87C` | Badges de "finalizada", valores positivos de comissão | Evitar como fundo sólido com texto branco em cima |
| Warning bg / text | `#FAEEDA` / `#633806` | Badge "Em andamento" | — |
| Warning forte (texto de alerta solto) | `#854F0B` | Aviso "Falta anexar: canhoto" | — |
| Danger (botão) | `#A32D2D` | Botão "Finalizar viagem" | Tom mais escuro que o `#EE5253` original — o original é claro demais para texto branco em cima |
| Danger bg / text (badge) | `#FCEBEB` / `#791F1F` | Badge "1 pendente" | — |
| Neutral Dark | `#1E293B` | Headers, texto principal | Igual ao original |
| Background | `#F8FAFC` | Fundo geral | Igual ao original |
| Border | `#E2E8F0` | Bordas de cards e inputs | Igual ao original |
| Chip claro | `#EFF6FF` | Fundo de chip de comissão, blocos de valor calculado | Novo — substitui o card verde sólido |

---

## 4. Arquitetura de navegação (área do motorista)

```
Início ──────────────┬──> Histórico (viagens finalizadas + resumo do mês)
  │                   │      ↑
  │                   └──────┘ (mesmo destino do ícone de histórico no header
  │                              e do item "Viagens" da bottom nav)
  │
  ├──> Cadastrar nova viagem ──> (Salvar para depois → volta pro Início)
  │                          └─> (Confirmar e iniciar → Viagem em andamento)
  │
  └──> [Toque em viagem programada] ──> Confirmar viagem ──> Viagem em andamento
                                              └─> Editar informações → Cadastrar/editar viagem

Viagem em andamento
  ├─ Abastecimento (painel expansível, sem sair da tela)
  ├─ Despesa (painel expansível, sem sair da tela)
  ├─ Parada (painel expansível — pernoite/almoço/descanso, com avaliação em estrelas para alimentar sugestões futuras)
  ├─ Carga complementar (painel expansível, sem sair da tela — soma ao frete e recalcula a comissão; só cobre carga extra pega em campo, não diária/pedágio/reentrega, que ficam com o gestor)
  ├─ Documentos (painel expansível, sem sair da tela)
  └─ Finalizar viagem ──> se documento obrigatório pendente: bloqueia com aviso e abre o painel de Documentos
                     └──> se documentação completa: abre painel "Conferência final"
                              └─ Confirmar finalização ──> Histórico (viagem finalizada)
```

**Importante:** "Finalizar viagem" nunca encerra a viagem diretamente — sempre passa por uma conferência antes (ver 5.11). Isso evita que o motorista finalize sem revisar km final e resultado da viagem.

Bottom nav: **Início · Viagens · Perfil** — "Viagens" aponta para o Histórico (viagens finalizadas), não para uma lista separada.

---

## 5. Telas e campos

### 5.0 Regra transversal — modelo de remuneração e adiantamento de viagem
Duas decisões de negócio que afetam várias telas ao mesmo tempo, então documentamos aqui antes de entrar tela por tela.

**a) Modelo de remuneração do motorista (`comissionado` × `assalariado`)**
Nem todo motorista ganha comissão por viagem — alguns recebem salário fixo. Isso precisa ser um campo no cadastro do motorista (`modelo_remuneracao`), e a interface se adapta conforme o valor:

| Elemento | Comissionado | Assalariado |
|---|---|---|
| Chip da tela Início | `14% comissão · R$ 1.400,00 este mês` | `4 viagens · 2.400 km este mês` (estatística operacional, sem valor em R$) |
| Bloco de comissão em Confirmar viagem e em Cadastrar viagem | Visível, travado (ver 5.2 e 5.3) | Some — substituído por uma nota simples: "Este motorista recebe salário fixo — sem comissão por viagem." |
| Faixa da Viagem em andamento | `Km inicial · Frete · Comissão` | `Km inicial · Frete` (sem a comissão) |
| Conferência final (5.11) | Mostra o resumo financeiro completo (Frete/Combustível/Despesas/Comissão/Resultado) | **O resumo financeiro inteiro some** — não só a comissão. Resultado operacional é uma métrica de margem da empresa; não há razão para expor isso a um motorista cujo pagamento não depende dela. Fica só a prestação de contas do adiantamento (item b). |

Vale confirmar com o dono se mesmo o motorista comissionado deveria ver o "Resultado operacional" completo (que revela a margem da empresa, não só a comissão dele) — hoje o protótipo mostra tudo, replicando o que veio na tela real analisada, mas essa é uma escolha de transparência que merece ser intencional, não um acidente de design.

**b) Adiantamento de viagem e prestação de contas**
Prática comum no setor: a empresa adianta um valor em dinheiro antes da viagem para cobrir combustível/alimentação, e no fim se confere quanto foi gasto contra o que foi adiantado. Isso é **independente do modelo de remuneração** — um motorista assalariado também pode receber adiantamento.

- Campo `Adiantamento (R$)` no formulário de Cadastrar viagem (5.3) — valor que a empresa entrega antes da viagem.
- Em Confirmar viagem (5.2), o valor do adiantamento aparece como mais uma linha de dados da viagem.
- Durante a Viagem em andamento (5.5), uma faixa compacta mostra `Adiantamento recebido · gasto até agora · saldo`, atualizada automaticamente sempre que uma despesa ou abastecimento é lançado como pago "com o adiantamento".
- O campo antes chamado `Pago por` (Empresa/Motorista) nos formulários de Despesa (5.7) e Abastecimento (5.9) virou **`Forma de pagamento`, com 3 opções**: `Adiantamento`, `Cartão da empresa`, `Próprio bolso do motorista` — porque as três têm consequência de acerto financeiro diferente entre si.
- Na Conferência final (5.11), um bloco de prestação de contas mostra o saldo final: se o motorista gastou menos que o adiantamento, o saldo é "a devolver à empresa"; se gastou mais, é "a reembolsar ao motorista".

### 5.1 Início (Home)
**Objetivo:** motorista decide em segundos entre continuar uma viagem programada ou iniciar uma nova.

Elementos:
- Header compacto: nome da transportadora (pequeno) + "Olá, [Motorista]"; ícones de histórico e sair (sem texto, para economizar espaço).
- Chip de comissão: `[X]% comissão · R$ [valor] este mês` — clicável, leva ao Histórico.
- Faixa de dados do veículo (uma linha): `Placa · Modelo · Km atual`.
- Lista **"Próximas viagens"** (viagens programadas, ainda não iniciadas): card por viagem com rota, data/prazo e veículo; toque abre a tela de confirmação.
- Se não houver viagem programada nem ativa: card único com CTA `Iniciar viagem`.
- Botão secundário (contorno, não preenchido): `+ Cadastrar nova viagem`.

### 5.2 Confirmar viagem (revisão de viagem programada)
**Objetivo:** motorista confere dados já preenchidos e inicia com o mínimo de toques.

Campos exibidos (somente leitura):
- Rota (origem → destino)
- Data
- Veículo
- Cliente/embarcador
- Carga
- Valor do frete
- **Adiantamento** (novo — ver 5.0b)
- Bloco de comissão (travado): percentual + valor estimado — **só para motorista comissionado** (ver 5.0a)

Ações: `Confirmar e iniciar viagem` (primária) · `Editar informações` (link secundário, leva ao formulário).

### 5.3 Cadastrar/editar viagem (formulário)
**Campos:**
| Campo | Tipo | Regra |
|---|---|---|
| Data | Date | — |
| Veículo | Select | Lista de veículos da frota |
| Cliente / embarcador | Select ou texto | Opcional |
| Origem | Texto | — |
| Destino | Texto | — |
| Carga | Texto | Opcional |
| Km inicial | Numérico | — |
| Valor do frete (R$) | Numérico | — |
| **Adiantamento (R$)** | Numérico | Novo — valor que a empresa entrega ao motorista antes da viagem (ver 5.0b) |
| **Comissão do motorista** | **Somente leitura** — só aparece para motorista comissionado (ver 5.0a) | Calculada como `valor do frete × comissão cadastrada no perfil do motorista`. Nunca editável nesta tela — vem do cadastro do motorista (tela do gestor, ainda não desenhada). Exibida com ícone de cadeado e legenda "Definida no cadastro do motorista." |
| Observações | Texto longo | Opcional |

Ações: `Salvar para depois` (cria viagem programada) · `Confirmar e iniciar viagem` (inicia agora — também é o momento em que o valor de adiantamento informado passa a valer para a viagem).

### 5.4 Histórico (somente viagens finalizadas)
**Importante:** esta tela mostra **exclusivamente viagens finalizadas** — nunca viagens ativas ou programadas (essas ficam no Início).

Elementos:
- Seletor de mês (`Setembro 2026 ▾`).
- Cards de resumo do mês: `Viagens no mês`, `Km rodados`, e `Comissão no mês` com indicador de tendência (`+12% vs mês anterior`).
- Lista de viagens finalizadas: rota, data/hora, km rodado, valor da comissão.

### 5.5 Viagem em andamento
Elementos:
- Rota + tipo de pagamento do frete + data/hora de início.
- Faixa compacta (uma linha): `Km inicial · Frete · Comissão (%)` — `Frete` e `Comissão` já refletem o total (base + carga complementar); a `Comissão` só aparece para motorista comissionado (ver 5.0a).
- **Faixa de adiantamento** (nova, sempre visível quando a viagem tem adiantamento, independente do modelo de remuneração): `Adiantamento recebido · gasto até agora · saldo`, atualizada automaticamente a cada despesa/abastecimento lançado com forma de pagamento "Adiantamento" (ver 5.0b).
- Atalhos rápidos, em grade de 2 colunas (abrem painel na mesma tela, sem navegar): `Abastecimento`, `Despesa`, `Parada`, `Carga extra`; `Documentos` ocupa a linha inteira por causa do badge `[N] pendente` quando houver documento obrigatório não enviado.
- Botão `Finalizar viagem` (destaque, cor de perigo). Se houver documento obrigatório pendente, o clique é bloqueado com aviso e abre o painel de Documentos — não avança para a conferência final (ver 5.11).
- **Registros da viagem** (seção única, não uma lista por tipo): chips de filtro (`Todos` / `Abastecimento` / `Despesa` / `Parada` / `Carga extra`) acima de uma lista compacta com ícone, descrição curta e valor. Vazio por padrão: `Nenhum lançamento registrado ainda.`. Essa consolidação existe **de propósito** — a tela já tem quatro tipos de lançamento possíveis, e uma seção fixa e sempre visível para cada tipo poluiria a tela conforme mais tipos forem adicionados no futuro. Uma lista única com filtro escala melhor.

### 5.6 Painel — Registrar parada
**Objetivo:** permitir que o motorista registre paradas de pernoite, almoço ou descanso durante a viagem, com uma avaliação simples, para que o sistema possa sugerir esse mesmo local em viagens futuras que passem pela mesma rota.

Decisão de design: **não é uma seção fixa na tela** — é um painel que abre por atalho, igual aos outros (Abastecimento, Despesa, Carga extra), e some quando não está em uso. A intenção explícita foi ter o registro sem adicionar peso visual permanente à tela.

| Campo | Tipo | Observação |
|---|---|---|
| Tipo de parada | Botões segmentados (2×2) | Pernoite / Almoço / Descanso / Outro |
| Local | Texto | Nome do lugar — ideal ter busca/autocomplete no futuro, hoje é texto livre |
| Avaliação | 5 estrelas, toque direto | Nenhum texto de "1 a 5" — a interação já é autoexplicativa |
| Comentário | Texto curto | Opcional — ex.: "estacionamento seguro, banheiro limpo" |

Data/hora não é pedida ao motorista — é capturada automaticamente no momento do registro.

**Como a sugestão funciona (ponto em aberto para decidir com o time técnico):** a forma mais simples de comparar "essa viagem passa pelo mesmo lugar de uma parada já avaliada" é por correspondência de texto no nome do local — simples de implementar, mas frágil (o motorista pode digitar o mesmo lugar de formas diferentes). A alternativa mais robusta é capturar a localização (latitude/longitude) do dispositivo no momento do registro, e comparar por proximidade geográfica nas rotas seguintes — mais confiável, mas exige permissão de localização e mais trabalho de backend. Recomendo decidir isso antes de implementar de verdade; o protótipo assume a versão simples (por nome) para fins de demonstração.

Onde a sugestão aparece: um cartão discreto e não-interativo na tela de **Confirmar viagem** (5.2), acima do botão de ação — uma linha só, com o nome do local e a nota em estrelas (ex.: "Parada frequente nesta rota: Restaurante do Zé ★★★★☆"). Não abre nada ao tocar; é só um lembrete.

### 5.7 Painel — Nova despesa
| Campo | Tipo | Observação |
|---|---|---|
| Data | Date | — |
| Categoria | Select | Ex.: Alimentação, Pedágio, Estacionamento |
| Valor (R$) | Numérico | — |
| Forma de pagamento | Seletor de 3 opções (Adiantamento / Cartão da empresa / Próprio bolso do motorista) | Substituiu o antigo "Pago por" (Empresa/Motorista) — ver 5.0b. Botões segmentados, não dropdown. Se "Adiantamento", o valor desconta do saldo do adiantamento da viagem em tempo real |
| Local / estabelecimento | Texto | Opcional |
| Descrição | Texto | Opcional |
| Comprovante | Ação dupla: `Tirar foto` / `Anexar arquivo` | A foto tirada aqui é salva automaticamente na lista de Documentos da viagem — não precisa reenviar |
| Observações | Texto longo | Opcional |

### 5.8 Painel — Carga complementar
**Origem:** decisão de negócio — no meio da rota, o motorista pode pegar uma carga adicional de outro cliente/embarcador, gerando receita extra sobre a mesma viagem. Diferente de uma despesa, isso é **receita**, não custo.

**Escopo definido:** este painel, do lado do motorista, trata **apenas de carga complementar** — é a única situação em que quem está em campo tem a informação de primeira mão (o que foi pego, onde, quanto pesa). Outros tipos de valor adicional ao frete (diária de espera, pedágio ou desvio não previstos, reentrega) **não são lançados pelo motorista**: normalmente é a empresa cliente que negocia e paga esse valor direto à transportadora, então quem registra é o gestor/financeiro, não quem está dirigindo. Esse lançamento pelo lado do gestor ainda não foi desenhado — fica como pendência para quando a Tela 4 (Gestão de Viagens/DRE) for revisada.

Regra de negócio central: o valor lançado aqui **soma ao valor do frete da viagem** e recalcula automaticamente a comissão do motorista (que é percentual sobre o frete) e o resultado operacional estimado. Isso é feito em tempo real assim que a carga complementar é salva — o motorista não precisa reabrir nada.

| Campo | Tipo | Observação |
|---|---|---|
| Data | Date | — |
| Cliente / embarcador da carga adicional | Texto | — |
| Local de coleta | Texto | Onde a carga extra foi pega |
| Local de entrega | Texto | Opcional — só se for diferente do destino já cadastrado na viagem |
| Peso / volume | Texto | Opcional |
| Valor (R$) | Numérico | Soma ao frete da viagem |
| Descrição | Texto | Opcional |
| Comprovante | Ação dupla: `Tirar foto` / `Anexar arquivo` | Mesmo comportamento dos outros painéis — salva automaticamente em Documentos da viagem |

Reflexos em outras telas:
- Faixa compacta no topo de "Viagem em andamento": `Frete` e `Comissão` passam a refletir o total (base + cargas complementares).
- Seção "Cargas complementares da viagem": lista os lançamentos, mesmo padrão de estado vazio das seções de Abastecimento e Despesa.
- Painel de Conferência final (5.11): o card de `Frete` mostra o total, com uma nota curta indicando quanto disso é carga complementar (ex.: "Inclui R$ 800,00 de carga complementar."), evitando esconder a composição do valor.

### 5.9 Painel — Novo abastecimento
| Campo | Tipo | Observação |
|---|---|---|
| Data | Date | — |
| Km | Numérico | — |
| Posto | Texto | — |
| Combustível | Select | Ex.: Diesel S10, Diesel S500, Arla 32 |
| Litros | Numérico | — |
| Preço por litro (R$) | Numérico | — |
| **Total (R$)** | Somente leitura | Calculado automaticamente: `litros × preço por litro` |
| Forma de pagamento | Seletor de 3 opções (Adiantamento / Cartão da empresa / Próprio bolso do motorista) | Mesma regra da despesa — ver 5.0b |
| Tanque cheio | Checkbox | — |
| Comprovante | Ação dupla: `Tirar foto` / `Anexar arquivo` | Mesmo comportamento do painel de despesa |

### 5.10 Painel — Documentos
| Campo | Tipo | Observação |
|---|---|---|
| Tipo de documento | Select | Inclui opção marcada como obrigatória, ex.: "Canhoto — obrigatório" |
| Arquivo | Ação dupla: `Tirar foto` / `Anexar arquivo` | — |
| Aviso de formatos aceitos | Texto fixo | Ex.: "JPG, PNG, WEBP e PDF · máximo 10MB" |

Regra de negócio: a viagem não pode ser finalizada enquanto o documento marcado como obrigatório (canhoto) não for enviado — mostrar aviso, não bloquear silenciosamente.

### 5.11 Painel — Conferência final (ao tocar em "Finalizar viagem")
**Origem:** identificado a partir de tela real já implementada. Reaproveita o conceito de "Margem Operacional" da Tela 4 do documento original (DRE por Rota), trazido para dentro do fluxo do motorista.

Só é possível abrir este painel se a documentação obrigatória já estiver completa — caso contrário, o toque em "Finalizar viagem" abre o painel de Documentos com aviso (ver 5.5).

Conteúdo:
- **Resumo financeiro — só para motorista comissionado** (ver 5.0a): cards de resumo (2 colunas no mobile, não 4 em linha — no celular real 4 valores lado a lado ficam ilegíveis): `Frete`, `Combustível`, `Despesas`, `Comissão`. Bloco de destaque: `Resultado operacional estimado` — valor em R$ **e** percentual sobre o frete lado a lado (ex.: `R$ 18.230,00` · `72,9%`), no mesmo padrão que a Tela 4 do documento original já usa (`Margem Operacional: R$ 4.740,00 (67,7%)`).
- **Prestação de contas do adiantamento — sempre visível quando há adiantamento** (ver 5.0b), independente do modelo de remuneração: `Adiantamento recebido`, `Total gasto com adiantamento`, e `Saldo`, com o rótulo mudando conforme o sinal — "a devolver à empresa" (motorista gastou menos que o adiantamento) ou "a reembolsar ao motorista" (gastou mais).
- `Km inicial`: **somente leitura** (é dado histórico da viagem, não deve parecer editável — mesma regra aplicada ao campo de comissão).
- `Km final`: editável, numérico.
- `Data/hora de chegada`: preenchido automaticamente com o momento atual, editável.
- `Local de chegada`: texto, editável.
- `Observações finais`: texto longo, opcional.
- Banner de confirmação (verde): "Canhoto anexado. A documentação obrigatória está completa." — é o complemento positivo do aviso âmbar mostrado enquanto o documento está pendente.
- Ação: `Confirmar finalização` — só agora a viagem muda de status para `finalizada` e o motorista é levado ao Histórico.

---

## 6. Entidades e campos sugeridos (rascunho para modelagem — não é schema final)

**Motorista**
`nome`, `modelo_remuneracao` (`comissionado` / `assalariado`), `comissao_percentual` (usado só quando `modelo_remuneracao = comissionado`), `cnh_validade`, `veiculo_vinculado_id`

**Veiculo**
`placa`, `modelo`, `km_atual`, `status`

**Viagem**
`motorista_id`, `veiculo_id`, `cliente`, `carga`, `origem`, `destino`, `data`, `km_inicial`, `km_final`, `forma_pagamento_frete`, `valor_frete` (valor original negociado), `valor_frete_total` (derivado: `valor_frete + soma dos complementos`), `comissao_valor` (derivado, não editável, só se aplica quando o motorista é comissionado: `valor_frete_total × comissao_percentual do motorista`), `valor_adiantamento` (recebido antes da viagem — ver 5.0b), `data_hora_chegada`, `local_chegada`, `observacoes_finais`, `resultado_operacional` (derivado: `valor_frete_total - total_combustivel - total_despesas - comissao_valor`; só calculado/exibido para viagens de motorista comissionado — ver pendência sobre exibir isso ao motorista), `status` (`programada` / `em_andamento` / `finalizada`)

**Abastecimento**
`viagem_id`, `data`, `km`, `posto`, `combustivel`, `litros`, `preco_litro`, `total` (derivado), `tanque_cheio`, `forma_pagamento` (`adiantamento` / `cartao_empresa` / `proprio_bolso`), `comprovante_url`

**Despesa**
`viagem_id`, `data`, `categoria`, `valor`, `forma_pagamento` (`adiantamento` / `cartao_empresa` / `proprio_bolso`), `local`, `descricao`, `comprovante_url`

**Complemento**
`viagem_id`, `data`, `origem_lancamento` (`motorista` — hoje o único caso implementado — ou `gestor`, para diária/pedágio/reentrega, ainda não desenhado), `cliente_carga_adicional`, `local_coleta`, `local_entrega` (opcional), `peso_volume` (opcional), `valor`, `descricao`, `comprovante_url`

**Parada**
`viagem_id`, `motorista_id`, `tipo` (`pernoite` / `almoco` / `descanso` / `outro`), `local_nome`, `latitude` (opcional — ver nota na seção 5.6 sobre como fazer o matching de rota), `longitude` (opcional), `avaliacao_estrelas` (1 a 5), `comentario`, `data_hora` (automático, não pedido ao motorista)

**Documento**
`viagem_id`, `tipo`, `obrigatorio` (bool), `arquivo_url`, `enviado_em`

---

## 7. Pendências (fora do escopo desta revisão)

- **Cadastro/edição de motorista** (tela do gestor) — é de onde vem o `comissao_percentual` usado em toda a área do motorista. Adiado a pedido do time.
- **Modo escuro** — citado na especificação original como diretriz, ainda sem paleta própria definida.
- **Comportamento offline** — não especificado; relevante porque o motorista opera em rotas com sinal instável.
- **Telas do gestor** (Dashboard, Mapa de Pneus, Gestão de Viagens/DRE, Manutenções, Financeiro) — seguem como no documento original, ainda não revisadas nesta sessão.
- **Padronização de ícones no restante do app** — aplicar o mesmo conjunto de ícones de traço único (outline) usado nas telas revisadas.
- **Lançamento de diária de espera, pedágio adicional e reentrega pelo gestor** — esses valores também somam ao frete e à comissão (mesma regra da carga complementar), mas quem lança é o gestor, não o motorista. Precisa de uma tela própria do lado do gestor (provavelmente dentro da Tela 4 — Gestão de Viagens/DRE).
- **Estratégia de correspondência de local para sugerir paradas** — decidir entre correspondência por texto (simples, mas frágil) ou por coordenadas geográficas (mais confiável, exige permissão de localização). Ver detalhes na seção 5.6.
- **Confirmar se o motorista comissionado deveria ver o "Resultado operacional" completo** — hoje o protótipo mostra a margem inteira da empresa (frete − custos − comissão), não só a comissão dele. É uma decisão de transparência do dono, não uma obrigação técnica; vale confirmar antes de considerar definitivo (ver nota na seção 5.0a).
- **O que acontece com o saldo do adiantamento quando uma viagem se estende para além do previsto** (ex.: motorista vai a Belo Horizonte e depois segue para outra cidade sem retornar à base) — o modelo atual assume que cada `Viagem` é autocontida, com seu próprio adiantamento e sua própria prestação de contas. Se o motorista de fato continuar viajando, o caminho recomendado é finalizar a viagem 1 (com sua conferência e acerto de adiantamento) e abrir uma viagem 2 — não esticar uma única viagem indefinidamente. Isso ainda não tem uma tela de decisão para o motorista ("essa é uma continuação ou uma nova viagem?"); fica como ponto em aberto.

---

## 8. Arquivos entregues junto com este documento

- `especificacao_revisada_app_motorista.md` — este documento.
- `prototipo_motorista.html` — protótipo estático navegável no navegador, cobrindo o fluxo completo: Início → Confirmar viagem → Cadastrar viagem → Histórico → Viagem em andamento (com os painéis de Abastecimento, Despesa, Parada, Carga complementar, Documentos e Conferência final). Inclui um toggle no topo da página para simular motorista comissionado × assalariado, e o acompanhamento de adiantamento de viagem em tempo real. Sem backend — é só para visualizar fluxo e hierarquia, não para produção.
