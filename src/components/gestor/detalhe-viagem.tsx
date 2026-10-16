import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import { Grade, Indicador, Secao } from '@/components/ui/cartao';
import { Segmentado } from '@/components/ui/segmentado';
import { Selo } from '@/components/ui/selo';
import { Cores, Espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  atualizarComplementoGestor,
  atualizarViagem,
  carregarDetalheViagem,
  excluirComplemento,
  excluirViagem,
  lancarComplementoGestor,
  ROTULO_COMPLEMENTO,
  ROTULO_PAGAMENTO,
  ROTULO_STATUS,
  sugerirAdiantamento,
  TIPOS_DO_GESTOR,
  urlDoArquivo,
  type Complemento,
  type DetalheViagem as Detalhe,
  type FormaPagamento,
  type StatusViagem,
  type TipoComplemento,
  type Viagem,
} from '@/services/viagens.service';
import { somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import {
  formatarData,
  formatarDataHora,
  formatarDecimal,
  formatarKm,
  formatarMoeda,
  formatarPercentual,
  hojeIso,
  lerData,
  lerDecimal,
  mascararDecimal,
} from '@/utils/formato';

type Props = {
  viagemId: string;
  nomeMotorista: string;
  placa: string;
  aoVoltar: () => void;
  aoEditar: (viagem: Viagem) => void;
};

/** Farol da margem (spec do gestor 6.3/6.5): ≥ 30% saudável, < 10% baixa. */
export function tomDaMargem(percentual: number | null): 'sucesso' | 'perigo' | 'neutro' {
  if (percentual === null) return 'neutro';
  if (percentual >= 30) return 'sucesso';
  if (percentual < 10) return 'perigo';
  return 'neutro';
}

export function margemPercentual(v: Viagem): number | null {
  if (v.status !== 'finalizada' || !v.valor_frete_total || v.resultado_operacional === null) return null;
  return Math.round((v.resultado_operacional * 1000) / v.valor_frete_total) / 10;
}

export function SeloCombustivel({ status }: { status: string | null }) {
  if (status === 'apurado') return <Selo tipo="sucesso">Apurado</Selo>;
  if (status === 'estimado') return <Selo tipo="neutro">Estimado</Selo>;
  return null;
}

export function DetalheViagem({ viagemId, nomeMotorista, placa, aoVoltar, aoEditar }: Props) {
  const buscar = useCallback(() => carregarDetalheViagem(viagemId), [viagemId]);
  const { dados, erro, recarregar } = useCarregar(buscar);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setErroAcao(null);
    try {
      await acao();
      recarregar();
    } catch (e) {
      setErroAcao(mensagemDeErro(e));
    }
  }

  if (!dados) {
    return (
      <Pagina titulo="Detalhe da viagem" acao={<Botao titulo="Voltar" variante="contorno" compacto onPress={aoVoltar} />}>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : <ActivityIndicator color={Cores.primaria} />}
      </Pagina>
    );
  }

  const { viagem: v } = dados;
  const status = v.status as StatusViagem;
  const margem = margemPercentual(v);

  return (
    <Pagina
      titulo={`${v.origem} → ${v.destino}`}
      subtitulo={`${nomeMotorista} · ${placa} · ${formatarData(v.data_prevista)}`}
      acao={<Botao titulo="Voltar" variante="contorno" compacto onPress={aoVoltar} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {erroAcao ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}

      <View style={styles.linha}>
        <Selo tipo={status === 'finalizada' ? 'sucesso' : status === 'em_andamento' ? 'aviso' : 'info'}>
          {ROTULO_STATUS[status]}
        </Selo>
        {v.cliente ? <Text style={styles.suave}>Cliente: {v.cliente}</Text> : null}
        {v.carga ? <Text style={styles.suave}>Carga: {v.carga}</Text> : null}
        {v.forma_pagamento_frete ? <Text style={styles.suave}>Pagamento do frete: {v.forma_pagamento_frete}</Text> : null}
      </View>

      <Grade>
        <Indicador rotulo="Frete bruto" valor={formatarMoeda(v.valor_frete_total)} detalhe={notaDoFrete(dados)} />
        <Indicador
          rotulo="Combustível"
          valor={formatarMoeda(v.combustivel_valor)}
          extra={<SeloCombustivel status={v.combustivel_status} />}
          detalhe={
            v.combustivel_status === 'estimado'
              ? 'Calculado por km rodado × consumo médio do veículo. Será corrigido quando o motorista reabastecer com tanque cheio.'
              : v.combustivel_status === 'apurado'
                ? 'Valor real, rateado a partir dos abastecimentos com tanque cheio.'
                : 'Calculado quando a viagem finalizar.'
          }
        />
        <Indicador
          rotulo="Comissão do motorista"
          valor={formatarMoeda(v.comissao_valor)}
          detalhe={v.comissao_percentual > 0 ? `${formatarDecimal(v.comissao_percentual)}% do frete` : 'Motorista assalariado'}
        />
        <Indicador rotulo="Outras despesas" valor={formatarMoeda(v.total_despesas)} />
        <Indicador
          rotulo="Margem operacional"
          tom={status === 'finalizada' ? tomDaMargem(margem) : 'neutro'}
          valor={status === 'finalizada' ? formatarMoeda(v.resultado_operacional) : '—'}
          detalhe={status === 'finalizada' ? formatarPercentual(margem) : 'Disponível ao finalizar'}
        />
      </Grade>

      <Secao titulo="Percurso">
        <View style={styles.linha}>
          <Text style={styles.texto}>Km inicial: {formatarKm(v.km_inicial)}</Text>
          <Text style={styles.texto}>Km final: {formatarKm(v.km_final)}</Text>
          {v.km_inicial !== null && v.km_final !== null ? (
            <Text style={styles.texto}>Rodado: {formatarKm(v.km_final - v.km_inicial)}</Text>
          ) : null}
        </View>
        {v.iniciada_em ? <Text style={styles.suave}>Iniciada em {formatarDataHora(v.iniciada_em)}</Text> : null}
        {v.data_hora_chegada ? (
          <Text style={styles.suave}>
            Chegada em {formatarDataHora(v.data_hora_chegada)}
            {v.local_chegada ? ` · ${v.local_chegada}` : ''}
          </Text>
        ) : null}
        {v.observacoes ? <Text style={styles.suave}>Observações: {v.observacoes}</Text> : null}
        {v.observacoes_finais ? <Text style={styles.suave}>Observações finais: {v.observacoes_finais}</Text> : null}
        {status === 'programada' ? (
          <View style={styles.linha}>
            <Botao titulo="Editar viagem" variante="contorno" compacto onPress={() => aoEditar(v)} />
            {confirmandoExcluir ? (
              <>
                <Botao
                  titulo="Confirmar exclusão"
                  variante="perigo"
                  compacto
                  onPress={() =>
                    executar(async () => {
                      await excluirViagem(v.id);
                      aoVoltar();
                    })
                  }
                />
                <Botao titulo="Cancelar" variante="link" compacto onPress={() => setConfirmandoExcluir(false)} />
              </>
            ) : (
              <Botao titulo="Excluir viagem" variante="link" compacto onPress={() => setConfirmandoExcluir(true)} />
            )}
          </View>
        ) : null}
      </Secao>

      <BlocoAdiantamento viagem={v} aoSalvar={(valor) => executar(() => atualizarViagem(v.id, { valor_adiantamento: valor }))} />

      <BlocoComplementos
        viagem={v}
        complementos={dados.complementos}
        aoLancar={(c) => executar(() => lancarComplementoGestor(v.id, c))}
        aoAtualizar={(id, c) => executar(() => atualizarComplementoGestor(id, c))}
        aoExcluir={(id) => executar(() => excluirComplemento(id))}
      />

      {status === 'finalizada' && (v.valor_adiantamento > 0 || v.gasto_proprio_bolso > 0) ? (
        <BlocoPrestacao
          viagem={v}
          aoMarcar={(acertado) => executar(() => atualizarViagem(v.id, { adiantamento_acertado: acertado }))}
        />
      ) : null}

      <BlocoRegistros dados={dados} aoErro={setErroAcao} />
    </Pagina>
  );
}

// "Nunca esconder a composição do valor" (spec do gestor 6.3)
function notaDoFrete({ viagem, complementos }: Detalhe): string | undefined {
  if (complementos.length === 0) return undefined;
  const porTipo = new Map<TipoComplemento, number[]>();
  for (const c of complementos) {
    const tipo = c.tipo as TipoComplemento;
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), c.valor]);
  }
  const partes = [...porTipo].map(
    ([tipo, valores]) => `${formatarMoeda(somar(valores))} de ${ROTULO_COMPLEMENTO[tipo].toLowerCase()}`,
  );
  return `Frete base ${formatarMoeda(viagem.valor_frete)}. Inclui ${partes.join(' e ')}.`;
}

function BlocoAdiantamento({ viagem, aoSalvar }: { viagem: Viagem; aoSalvar: (valor: number) => Promise<void> }) {
  const buscar = useCallback(() => sugerirAdiantamento(viagem.origem, viagem.destino), [viagem.origem, viagem.destino]);
  const { dados: sugestao } = useCarregar(buscar);
  const [valor, setValor] = useState(formatarDecimal(viagem.valor_adiantamento));
  const [erro, setErro] = useState<string | null>(null);
  const travado = viagem.status === 'finalizada';

  function salvar() {
    const novo = lerDecimal(valor) ?? 0;
    if (Number.isNaN(novo)) return setErro('Valor inválido.');
    setErro(null);
    aoSalvar(novo);
  }

  return (
    <Secao titulo="Adiantamento">
      <Grade>
        <Indicador
          rotulo="Valor sugerido"
          tom="destaque"
          valor={sugestao?.valor != null ? formatarMoeda(sugestao.valor) : 'Sem histórico nesta rota'}
          detalhe={
            sugestao?.valor != null
              ? `Média de ${sugestao.quantidade} viagem(ns) em ${viagem.origem} → ${viagem.destino}`
              : undefined
          }
        />
      </Grade>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {travado ? (
        <Text style={styles.texto}>Valor definido: {formatarMoeda(viagem.valor_adiantamento)}</Text>
      ) : (
        <>
          <Campo
            rotulo="Valor definido (R$)"
            ajuda="Se o motorista já iniciou a viagem, o valor novo aparece no app dele."
            value={valor}
            onChangeText={(t) => setValor(mascararDecimal(t))}
            keyboardType="numeric"
            inputMode="decimal"
          />
          <Botao titulo="Salvar adiantamento" variante="contorno" compacto onPress={salvar} />
        </>
      )}
    </Secao>
  );
}

type PropsComplementos = {
  viagem: Viagem;
  complementos: Complemento[];
  aoLancar: (c: { tipo: TipoComplemento; valor: number; data: string; descricao: string | null }) => Promise<void>;
  aoAtualizar: (id: string, c: { tipo: TipoComplemento; valor: number; data: string; descricao: string | null }) => Promise<void>;
  aoExcluir: (id: string) => Promise<void>;
};

function BlocoComplementos({ viagem, complementos, aoLancar, aoAtualizar, aoExcluir }: PropsComplementos) {
  const [aberto, setAberto] = useState(false);
  // id do lançamento em edição; null = lançamento novo
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoComplemento>('diaria_espera');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(formatarData(hojeIso()));
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const editavel = viagem.status !== 'finalizada';

  async function lancar() {
    const v = lerDecimal(valor);
    const d = lerData(data);
    if (v === null || Number.isNaN(v) || v <= 0) return setErro('Informe o valor.');
    if (!d) return setErro('Data inválida. Use dia/mês/ano.');
    setErro(null);
    const dados = { tipo, valor: v, data: d, descricao: descricao.trim() || null };
    if (editandoId) await aoAtualizar(editandoId, dados);
    else await aoLancar(dados);
    fechar();
  }

  function fechar() {
    setValor('');
    setDescricao('');
    setEditandoId(null);
    setAberto(false);
  }

  function editar(c: Complemento) {
    setEditandoId(c.id);
    setTipo(c.tipo as TipoComplemento);
    setValor(formatarDecimal(c.valor));
    setData(formatarData(c.data));
    setDescricao(c.descricao ?? '');
    setErro(null);
    setAberto(true);
  }

  return (
    <Secao
      titulo="Valores adicionais ao frete"
      acao={
        editavel && !aberto ? (
          <Botao titulo="+ Lançar valor adicional" variante="contorno" compacto onPress={() => setAberto(true)} />
        ) : undefined
      }>
      {aberto ? (
        <View style={styles.formulario}>
          {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
          <Segmentado rotulo="Tipo" opcoes={TIPOS_DO_GESTOR} valor={tipo} onChange={setTipo} />
          <Campo
            rotulo="Valor (R$)"
            ajuda="Soma ao frete total da viagem e à base de comissão."
            value={valor}
            onChangeText={(t) => setValor(mascararDecimal(t))}
            keyboardType="numeric"
            inputMode="decimal"
          />
          <CampoData
            rotulo="Data"
            valor={data}
            onChange={setData}
          />
          <Campo rotulo="Observação (opcional)" value={descricao} onChangeText={setDescricao} />
          <View style={styles.linha}>
            <Botao titulo={editandoId ? 'Salvar alteração' : 'Lançar'} compacto onPress={lancar} />
            <Botao titulo="Cancelar" variante="link" compacto onPress={fechar} />
          </View>
        </View>
      ) : null}

      {complementos.length === 0 ? (
        <Text style={styles.suave}>Nenhum valor adicional lançado.</Text>
      ) : (
        complementos.map((c) => (
          <View key={c.id} style={styles.item}>
            <View style={styles.itemTexto}>
              <Text style={styles.texto}>
                {ROTULO_COMPLEMENTO[c.tipo as TipoComplemento]} · {formatarMoeda(c.valor)}
              </Text>
              <Text style={styles.suave}>
                {formatarData(c.data)}
                {c.cliente_carga_adicional ? ` · ${c.cliente_carga_adicional}` : ''}
                {c.descricao ? ` · ${c.descricao}` : ''}
              </Text>
            </View>
            {/* quem lançou o quê fica sempre visível (spec, seção 2) */}
            <Selo tipo={c.origem_lancamento === 'gestor' ? 'info' : 'neutro'}>
              {c.origem_lancamento === 'gestor' ? 'Lançado pela gestão' : 'Lançado pelo motorista'}
            </Selo>
            {/* a carga complementar é do motorista: o gestor remove, mas não reescreve */}
            {editavel && c.origem_lancamento === 'gestor' ? (
              <Botao titulo="Editar" variante="link" compacto onPress={() => editar(c)} />
            ) : null}
            {editavel ? <Botao titulo="Remover" variante="link" compacto onPress={() => aoExcluir(c.id)} /> : null}
          </View>
        ))
      )}
    </Secao>
  );
}

function BlocoPrestacao({ viagem: v, aoMarcar }: { viagem: Viagem; aoMarcar: (acertado: boolean) => Promise<void> }) {
  const saldo = v.adiantamento_saldo ?? 0;
  return (
    <Secao titulo="Prestação de contas do adiantamento">
      <Grade>
        <Indicador rotulo="Adiantamento" valor={formatarMoeda(v.valor_adiantamento)} />
        <Indicador rotulo="Gasto pelo motorista" valor={formatarMoeda(v.adiantamento_gasto)} />
        <Indicador
          rotulo={saldo >= 0 ? 'Saldo a devolver pelo motorista' : 'Saldo a reembolsar ao motorista'}
          tom="destaque"
          valor={formatarMoeda(Math.abs(saldo))}
        />
        {v.gasto_proprio_bolso > 0 ? (
          <Indicador
            rotulo="Pago do próprio bolso"
            valor={formatarMoeda(v.gasto_proprio_bolso)}
            detalhe="A reembolsar ao motorista, além do saldo do adiantamento."
          />
        ) : null}
      </Grade>
      {v.adiantamento_acertado ? (
        <View style={styles.linha}>
          <Selo tipo="sucesso">{`Acertado em ${formatarData(v.adiantamento_acertado_em)}`}</Selo>
          <Botao titulo="Desfazer" variante="link" compacto onPress={() => aoMarcar(false)} />
        </View>
      ) : (
        <Botao titulo="Marcar como acertado" compacto onPress={() => aoMarcar(true)} />
      )}
    </Secao>
  );
}

function BlocoRegistros({ dados, aoErro }: { dados: Detalhe; aoErro: (mensagem: string) => void }) {
  const { abastecimentos, despesas, paradas, documentos } = dados;

  async function abrir(caminho: string) {
    try {
      await Linking.openURL(await urlDoArquivo(caminho));
    } catch (e) {
      aoErro(mensagemDeErro(e));
    }
  }
  const comprovante = (caminho: string | null) =>
    caminho ? <Botao titulo="Comprovante" variante="link" compacto onPress={() => abrir(caminho)} /> : null;

  return (
    <>
      <Secao titulo="Abastecimentos">
        {abastecimentos.length === 0 ? <Text style={styles.suave}>Nenhum abastecimento nesta viagem.</Text> : null}
        {abastecimentos.map((a) => (
          <View key={a.id} style={styles.item}>
            <View style={styles.itemTexto}>
              <Text style={styles.texto}>
                {formatarMoeda(a.total)} · {formatarDecimal(a.litros, 1)} L a {formatarDecimal(a.preco_litro, 3)}
              </Text>
              <Text style={styles.suave}>
                {formatarData(a.data)} · {formatarKm(a.km)}
                {a.posto ? ` · ${a.posto}` : ''} · {ROTULO_PAGAMENTO[a.forma_pagamento as FormaPagamento]}
              </Text>
            </View>
            {a.tanque_cheio ? <Selo tipo="info">Tanque cheio</Selo> : null}
            {comprovante(a.comprovante_path)}
          </View>
        ))}
      </Secao>

      <Secao titulo="Despesas">
        {despesas.length === 0 ? <Text style={styles.suave}>Nenhuma despesa nesta viagem.</Text> : null}
        {despesas.map((d) => (
          <View key={d.id} style={styles.item}>
            <View style={styles.itemTexto}>
              <Text style={styles.texto}>
                {d.categoria} · {formatarMoeda(d.valor)}
              </Text>
              <Text style={styles.suave}>
                {formatarData(d.data)} · {ROTULO_PAGAMENTO[d.forma_pagamento as FormaPagamento]}
                {d.local ? ` · ${d.local}` : ''}
                {d.descricao ? ` · ${d.descricao}` : ''}
              </Text>
            </View>
            {comprovante(d.comprovante_path)}
          </View>
        ))}
      </Secao>

      {paradas.length > 0 ? (
        <Secao titulo="Paradas">
          {paradas.map((p) => (
            <View key={p.id} style={styles.item}>
              <View style={styles.itemTexto}>
                <Text style={styles.texto}>
                  {p.local_nome} {p.avaliacao_estrelas ? '★'.repeat(p.avaliacao_estrelas) + '☆'.repeat(5 - p.avaliacao_estrelas) : ''}
                </Text>
                <Text style={styles.suave}>
                  {p.tipo} · {formatarDataHora(p.data_hora)}
                  {p.comentario ? ` · ${p.comentario}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </Secao>
      ) : null}

      <Secao titulo="Documentos">
        {documentos.length === 0 ? <Text style={styles.suave}>Nenhum documento enviado.</Text> : null}
        {documentos.map((d) => (
          <View key={d.id} style={styles.item}>
            <View style={styles.itemTexto}>
              <Text style={styles.texto}>{d.tipo === 'canhoto' ? 'Canhoto' : d.tipo}</Text>
              <Text style={styles.suave}>Enviado em {formatarDataHora(d.enviado_em)}</Text>
            </View>
            <Botao titulo="Abrir" variante="link" compacto onPress={() => abrir(d.arquivo_path)} />
          </View>
        ))}
      </Secao>
    </>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  texto: { fontSize: 14, color: Cores.texto },
  suave: { fontSize: 13, color: Cores.textoSuave },
  formulario: { gap: Espaco.md, paddingBottom: Espaco.md, borderBottomWidth: 1, borderBottomColor: Cores.borda },
  item: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Espaco.md,
    paddingVertical: Espaco.sm,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
  },
  itemTexto: { flex: 1, minWidth: 200, gap: 2 },
});
