import * as Location from 'expo-location';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CamposPagamento, dadosDoPagamento } from '@/components/campos-pagamento';
import { BotaoLerNota, ResumoNota, separarNota } from '@/components/leitor-nota';
import { CampoAnexo, Cartao, Dado, estilosMotorista as em, ValorCalculado } from '@/components/motorista/base';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import { Segmentado } from '@/components/ui/segmentado';
import { CATEGORIAS_DESPESA, COMBUSTIVEIS, despesaExigeComprovante, PAGAMENTOS, type Combustivel } from '@/constants/lancamentos';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useMotorista } from '@/context/MotoristaContext';
import type { Anexo } from '@/services/anexo.service';
import type { Registro, ViagemMotorista } from '@/services/motorista.service';
import type { ItemNota, NotaLida } from '@/services/nota.service';
import type { FormaPagamento } from '@/services/viagens.service';
import { somar, totalAbastecimento } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import {
  formatarData,
  formatarDataHora,
  formatarDecimal,
  formatarKm,
  formatarMoeda,
  hojeIso,
  lerData,
  lerDecimal,
  mascararDecimal,
} from '@/utils/formato';

// Painéis da viagem em andamento: abrem na própria tela, sem navegar (spec do motorista 5.5).

export type TipoPainel = 'abastecimento' | 'despesa' | 'parada' | 'carga' | 'documentos' | 'conferencia';

type PropsPainel = { viagem: ViagemMotorista; aoFechar: () => void };

function Moldura({ titulo, erro, children, aoFechar }: { titulo: string; erro: string | null; children: ReactNode; aoFechar: () => void }) {
  return (
    <Cartao>
      <View style={styles.cabecalho}>
        <Text accessibilityRole="header" style={em.titulo}>
          {titulo}
        </Text>
        <Botao titulo="Fechar" variante="link" compacto onPress={aoFechar} />
      </View>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {children}
    </Cartao>
  );
}

/** Estado e envio comuns: mostra erro, trava o botão e fecha o painel ao gravar. */
function useEnvio(aoFechar: () => void) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  async function enviar(acao: () => Promise<void>) {
    setErro(null);
    setSalvando(true);
    try {
      await acao();
      setSalvando(false);
      aoFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }
  return { erro, setErro, salvando, enviar };
}

const numerico = { keyboardType: 'numeric', inputMode: 'decimal' } as const;

// --- 5.9 Novo abastecimento ---------------------------------------------------------

export function PainelAbastecimento({ viagem, aoFechar }: PropsPainel) {
  const { lancarAbastecimento, perfil } = useMotorista();
  const { erro, setErro, salvando, enviar } = useEnvio(aoFechar);
  const [data, setData] = useState(formatarData(hojeIso()));
  const [km, setKm] = useState('');
  const [posto, setPosto] = useState('');
  const [combustivel, setCombustivel] = useState<Combustivel>('diesel_s10');
  const [litros, setLitros] = useState('');
  const [preco, setPreco] = useState('');
  const [pagamento, setPagamento] = useState<FormaPagamento | null>(viagem.valor_adiantamento > 0 ? 'adiantamento' : null);
  const [cheio, setCheio] = useState(false);
  const [chavePix, setChavePix] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  // nota fiscal lida: o diesel preenche o formulário; Arla e outros combustíveis vão junto
  const [nota, setNota] = useState<NotaLida | null>(null);
  const [extras, setExtras] = useState<ItemNota[]>([]);
  const [lancarExtras, setLancarExtras] = useState(true);
  // preço digitado tem 3 casas; o da nota (com desconto) vem com 4
  const [casasPreco, setCasasPreco] = useState(3);
  const placa = perfil.veiculos.find((v) => v.id === viagem.veiculo_id)?.placa ?? null;

  const litrosLidos = lerDecimal(litros);
  const precoLido = lerDecimal(preco);
  const total = litrosLidos && precoLido ? totalAbastecimento(litrosLidos, precoLido) : null;

  function aplicarNota(lida: NotaLida) {
    const { principal, extras: outros } = separarNota(lida);
    setNota(lida);
    setExtras(outros);
    setLancarExtras(true);
    if (lida.data) setData(formatarData(lida.data));
    if (lida.km) setKm(formatarDecimal(lida.km, 0));
    if (lida.emitente) setPosto(lida.emitente);
    if (principal) {
      setCombustivel(principal.combustivel);
      setLitros(formatarDecimal(principal.quantidade, 3));
      setPreco(formatarDecimal(principal.precoUnitario, 4));
      setCasasPreco(4);
    }
  }

  function salvar() {
    const dataIso = lerData(data);
    const kmLido = lerDecimal(km);
    if (!dataIso) return setErro('Data inválida. Use dia/mês/ano.');
    if (kmLido === null || Number.isNaN(kmLido)) return setErro('Informe o km do odômetro.');
    if (viagem.km_inicial !== null && kmLido < viagem.km_inicial) {
      return setErro(`O km não pode ser menor que o km inicial da viagem (${formatarKm(viagem.km_inicial)}).`);
    }
    if (!litrosLidos || Number.isNaN(litrosLidos)) return setErro('Informe os litros.');
    if (!precoLido || Number.isNaN(precoLido)) return setErro('Informe o preço por litro.');
    if (!pagamento) return setErro('Escolha a forma de pagamento.');
    const extra = dadosDoPagamento(pagamento, chavePix, vencimento);
    if (typeof extra === 'string') return setErro(extra);
    const comum = { data: dataIso, km: kmLido, posto: posto.trim() || null, forma_pagamento: pagamento, ...extra };
    enviar(async () => {
      await lancarAbastecimento(
        viagem,
        {
          ...comum,
          combustivel,
          litros: litrosLidos,
          preco_litro: precoLido,
          total: totalAbastecimento(litrosLidos, precoLido),
          tanque_cheio: cheio,
        },
        anexo,
      );
      // Arla e outros itens da mesma nota: mesmo dia, km e pagamento (o comprovante fica no principal)
      if (lancarExtras) {
        for (const item of extras) {
          await lancarAbastecimento(
            viagem,
            {
              ...comum,
              combustivel: item.combustivel ?? 'arla32',
              litros: item.quantidade,
              preco_litro: item.precoUnitario,
              total: totalAbastecimento(item.quantidade, item.precoUnitario),
              tanque_cheio: false,
            },
            null,
          );
        }
      }
    });
  }

  return (
    <Moldura titulo="Novo abastecimento" erro={erro} aoFechar={aoFechar}>
      <BotaoLerNota aoLer={aplicarNota} />
      {nota ? (
        <ResumoNota nota={nota} placa={placa} extras={extras} lancarExtras={lancarExtras} aoMudarLancarExtras={setLancarExtras} />
      ) : null}
      <CampoData rotulo="Data" valor={data} onChange={setData} />
      <Campo rotulo="Km (odômetro)" value={km} onChangeText={setKm} {...numerico} />
      <Campo rotulo="Posto" value={posto} onChangeText={setPosto} />
      <Segmentado rotulo="Combustível" opcoes={COMBUSTIVEIS} valor={combustivel} onChange={setCombustivel} />
      <Campo rotulo="Litros" value={litros} onChangeText={setLitros} {...numerico} />
      <Campo
        rotulo="Preço por litro (R$)"
        value={preco}
        onChangeText={(t) => {
          if (!t) setCasasPreco(3);
          setPreco(mascararDecimal(t, casasPreco));
        }}
        placeholder="Ex.: 5,899"
        {...numerico}
      />
      <ValorCalculado rotulo="Total" valor={total === null ? '—' : formatarMoeda(total)} nota="Litros × preço por litro" />
      <Segmentado rotulo="Forma de pagamento" opcoes={PAGAMENTOS} valor={pagamento} onChange={setPagamento} />
      <CamposPagamento
        pagamento={pagamento}
        chavePix={chavePix}
        aoMudarChavePix={setChavePix}
        vencimento={vencimento}
        aoMudarVencimento={setVencimento}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: cheio }}
        onPress={() => setCheio(!cheio)}
        style={styles.caixa}>
        <View style={[styles.quadrado, cheio && styles.quadradoMarcado]}>
          {cheio ? <Text style={styles.visto}>✓</Text> : null}
        </View>
        <Text style={em.texto}>Tanque cheio</Text>
      </Pressable>
      <CampoAnexo rotulo="Comprovante" anexo={anexo} onChange={setAnexo} />
      <Botao titulo="Salvar abastecimento" onPress={salvar} carregando={salvando} />
    </Moldura>
  );
}

// --- 5.7 Nova despesa ---------------------------------------------------------------

export function PainelDespesa({ viagem, aoFechar }: PropsPainel) {
  const { lancarDespesa } = useMotorista();
  const { erro, setErro, salvando, enviar } = useEnvio(aoFechar);
  const [data, setData] = useState(formatarData(hojeIso()));
  const [categoria, setCategoria] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [pagamento, setPagamento] = useState<FormaPagamento | null>(viagem.valor_adiantamento > 0 ? 'adiantamento' : null);
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [anexo, setAnexo] = useState<Anexo | null>(null);

  function salvar() {
    const dataIso = lerData(data);
    const valorLido = lerDecimal(valor);
    if (!dataIso) return setErro('Data inválida. Use dia/mês/ano.');
    if (!categoria) return setErro('Escolha a categoria.');
    if (!valorLido || Number.isNaN(valorLido)) return setErro('Informe o valor.');
    if (!pagamento) return setErro('Escolha a forma de pagamento.');
    if (despesaExigeComprovante(pagamento) && !anexo) {
      return setErro('Tire a foto ou anexe o comprovante. Ele é obrigatório para esta forma de pagamento.');
    }
    const extra = dadosDoPagamento(pagamento, chavePix, vencimento);
    if (typeof extra === 'string') return setErro(extra);
    enviar(() =>
      lancarDespesa(
        viagem,
        {
          data: dataIso,
          categoria,
          valor: valorLido,
          forma_pagamento: pagamento,
          ...extra,
          local: local.trim() || null,
          descricao: descricao.trim() || null,
          observacoes: observacoes.trim() || null,
        },
        anexo,
      ),
    );
  }

  return (
    <Moldura titulo="Nova despesa" erro={erro} aoFechar={aoFechar}>
      <CampoData rotulo="Data" valor={data} onChange={setData} />
      <Segmentado rotulo="Categoria" opcoes={CATEGORIAS_DESPESA} valor={categoria} onChange={setCategoria} />
      <Campo rotulo="Valor (R$)" value={valor} onChangeText={(t) => setValor(mascararDecimal(t))} {...numerico} />
      <Segmentado
        rotulo="Forma de pagamento"
        opcoes={PAGAMENTOS}
        valor={pagamento}
        onChange={setPagamento}
        ajuda={pagamento === 'adiantamento' ? 'Desconta do saldo do adiantamento da viagem.' : undefined}
      />
      <CamposPagamento
        pagamento={pagamento}
        chavePix={chavePix}
        aoMudarChavePix={setChavePix}
        vencimento={vencimento}
        aoMudarVencimento={setVencimento}
      />
      <Campo rotulo="Local / estabelecimento (opcional)" value={local} onChangeText={setLocal} />
      <Campo rotulo="Descrição (opcional)" value={descricao} onChangeText={setDescricao} />
      <CampoAnexo
        rotulo={despesaExigeComprovante(pagamento) ? 'Comprovante (obrigatório)' : 'Comprovante (opcional)'}
        anexo={anexo}
        onChange={setAnexo}
      />
      <Campo rotulo="Observações (opcional)" value={observacoes} onChangeText={setObservacoes} multiline />
      <Botao titulo="Salvar despesa" onPress={salvar} carregando={salvando} />
    </Moldura>
  );
}

// --- 5.6 Registrar parada -----------------------------------------------------------

const TIPOS_PARADA = [
  { valor: 'pernoite', rotulo: 'Pernoite' },
  { valor: 'almoco', rotulo: 'Almoço' },
  { valor: 'descanso', rotulo: 'Descanso' },
  { valor: 'outro', rotulo: 'Outro' },
] as const;

/** Posição do aparelho, se o motorista permitir e o GPS responder em 5 s. Nunca atrasa o registro. */
async function posicaoAtual(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const permissao = await Location.requestForegroundPermissionsAsync();
    if (!permissao.granted) return null;
    const limite = new Promise<null>((resolver) => setTimeout(() => resolver(null), 5000));
    const posicao = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      limite,
    ]);
    return posicao ? { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude } : null;
  } catch {
    return null;
  }
}

export function Estrelas({ valor, onChange }: { valor: number; onChange?: (v: number) => void }) {
  return (
    <View accessibilityRole="adjustable" accessibilityLabel={`Avaliação: ${valor} de 5 estrelas`} style={em.linha}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityLabel={`${n} estrela${n === 1 ? '' : 's'}`}
          disabled={!onChange}
          onPress={() => onChange?.(n)}
          style={styles.estrela}>
          <Text style={[styles.estrelaTexto, n <= valor && styles.estrelaCheia]}>{n <= valor ? '★' : '☆'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function PainelParada({ viagem, aoFechar }: PropsPainel) {
  const { lancarParada } = useMotorista();
  const { erro, setErro, salvando, enviar } = useEnvio(aoFechar);
  const [tipo, setTipo] = useState<(typeof TIPOS_PARADA)[number]['valor'] | null>(null);
  const [local, setLocal] = useState('');
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState('');

  function salvar() {
    if (!tipo) return setErro('Escolha o tipo de parada.');
    if (!local.trim()) return setErro('Informe o nome do local.');
    enviar(async () => {
      const posicao = await posicaoAtual();
      await lancarParada(viagem, {
        tipo,
        local_nome: local.trim(),
        avaliacao_estrelas: estrelas || null,
        comentario: comentario.trim() || null,
        latitude: posicao?.latitude ?? null,
        longitude: posicao?.longitude ?? null,
      });
    });
  }

  return (
    <Moldura titulo="Registrar parada" erro={erro} aoFechar={aoFechar}>
      <Segmentado rotulo="Tipo de parada" opcoes={TIPOS_PARADA} valor={tipo} onChange={setTipo} />
      <Campo rotulo="Local" value={local} onChangeText={setLocal} placeholder="Nome do posto, restaurante…" />
      <Text style={styles.rotulo}>Avaliação</Text>
      <Estrelas valor={estrelas} onChange={setEstrelas} />
      <Campo
        rotulo="Comentário (opcional)"
        value={comentario}
        onChangeText={setComentario}
        placeholder="Ex.: estacionamento seguro, banheiro limpo"
      />
      <Text style={em.suave}>A data e a hora são registradas automaticamente.</Text>
      <Botao titulo="Salvar parada" onPress={salvar} carregando={salvando} />
    </Moldura>
  );
}

// --- 5.8 Carga complementar ----------------------------------------------------------

export function PainelCarga({ viagem, aoFechar }: PropsPainel) {
  const { lancarComplemento } = useMotorista();
  const { erro, setErro, salvando, enviar } = useEnvio(aoFechar);
  const [data, setData] = useState(formatarData(hojeIso()));
  const [cliente, setCliente] = useState('');
  const [coleta, setColeta] = useState('');
  const [entrega, setEntrega] = useState('');
  const [peso, setPeso] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [anexo, setAnexo] = useState<Anexo | null>(null);

  function salvar() {
    const dataIso = lerData(data);
    const valorLido = lerDecimal(valor);
    if (!dataIso) return setErro('Data inválida. Use dia/mês/ano.');
    if (!cliente.trim()) return setErro('Informe o cliente da carga adicional.');
    if (!coleta.trim()) return setErro('Informe o local de coleta.');
    if (!valorLido || Number.isNaN(valorLido)) return setErro('Informe o valor.');
    enviar(() =>
      lancarComplemento(
        viagem,
        {
          data: dataIso,
          valor: valorLido,
          cliente_carga_adicional: cliente.trim(),
          local_coleta: coleta.trim(),
          local_entrega: entrega.trim() || null,
          peso_volume: peso.trim() || null,
          descricao: descricao.trim() || null,
        },
        anexo,
      ),
    );
  }

  return (
    <Moldura titulo="Carga complementar" erro={erro} aoFechar={aoFechar}>
      <Text style={em.suave}>Carga extra pega no caminho. O valor soma ao frete da viagem.</Text>
      <CampoData rotulo="Data" valor={data} onChange={setData} />
      <Campo rotulo="Cliente / embarcador da carga adicional" value={cliente} onChangeText={setCliente} />
      <Campo rotulo="Local de coleta" value={coleta} onChangeText={setColeta} />
      <Campo
        rotulo="Local de entrega (opcional)"
        ajuda="Só se for diferente do destino da viagem."
        value={entrega}
        onChangeText={setEntrega}
      />
      <Campo rotulo="Peso / volume (opcional)" value={peso} onChangeText={setPeso} />
      <Campo rotulo="Valor (R$)" value={valor} onChangeText={(t) => setValor(mascararDecimal(t))} {...numerico} />
      <Campo rotulo="Descrição (opcional)" value={descricao} onChangeText={setDescricao} />
      <CampoAnexo rotulo="Comprovante" anexo={anexo} onChange={setAnexo} />
      <Botao titulo="Salvar carga complementar" onPress={salvar} carregando={salvando} />
    </Moldura>
  );
}

// --- 5.10 Documentos ------------------------------------------------------------------

const TIPOS_DOCUMENTO = [
  { valor: 'canhoto', rotulo: 'Canhoto — obrigatório' },
  { valor: 'cte', rotulo: 'CT-e' },
  { valor: 'nota_fiscal', rotulo: 'Nota fiscal' },
  { valor: 'outro', rotulo: 'Outro' },
] as const;

const NOME_DOCUMENTO: Record<string, string> = {
  canhoto: 'Canhoto',
  cte: 'CT-e',
  nota_fiscal: 'Nota fiscal',
  comprovante: 'Comprovante',
  outro: 'Outro',
};

export const temCanhoto = (viagemId: string, registros: Registro[]) =>
  registros.some((r) => r.tabela === 'documentos' && r.linha.viagem_id === viagemId && r.linha.tipo === 'canhoto');

export function PainelDocumentos({ viagem, aoFechar, aviso }: PropsPainel & { aviso?: string }) {
  const { enviarDocumento, registros } = useMotorista();
  const { erro, setErro, salvando, enviar } = useEnvio(() => {});
  const [tipo, setTipo] = useState<(typeof TIPOS_DOCUMENTO)[number]['valor']>(
    temCanhoto(viagem.id, registros) ? 'outro' : 'canhoto',
  );
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  const documentos = registros.filter((r) => r.tabela === 'documentos' && r.linha.viagem_id === viagem.id);

  function salvar() {
    if (!anexo) return setErro('Tire a foto ou anexe o arquivo.');
    enviar(async () => {
      await enviarDocumento(viagem, tipo, anexo);
      setAnexo(null);
    });
  }

  return (
    <Moldura titulo="Documentos" erro={erro} aoFechar={aoFechar}>
      {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : null}
      {temCanhoto(viagem.id, registros) ? (
        <Aviso tipo="sucesso">Canhoto anexado. A documentação obrigatória está completa.</Aviso>
      ) : (
        <Aviso tipo="info">Falta anexar: canhoto. Sem ele a viagem não pode ser finalizada.</Aviso>
      )}
      <Segmentado rotulo="Tipo de documento" opcoes={TIPOS_DOCUMENTO} valor={tipo} onChange={setTipo} />
      <CampoAnexo rotulo="Arquivo" anexo={anexo} onChange={setAnexo} />
      <Text style={em.suave}>JPG, PNG, WEBP e PDF · máximo 10 MB</Text>
      <Botao titulo="Enviar documento" onPress={salvar} carregando={salvando} desativado={!anexo} />
      {documentos.length > 0 ? <Text style={styles.rotulo}>Enviados nesta viagem</Text> : null}
      {documentos.map((d) =>
        d.tabela === 'documentos' ? (
          <View key={d.linha.id} style={styles.item}>
            <Text style={em.texto}>{NOME_DOCUMENTO[d.linha.tipo] ?? d.linha.tipo}</Text>
            <Text style={em.suave}>{d.pendente ? 'Aguardando envio' : formatarDataHora(d.linha.enviado_em)}</Text>
          </View>
        ) : null,
      )}
    </Moldura>
  );
}

// --- 5.11 Conferência final -----------------------------------------------------------

const dois = (n: number) => String(n).padStart(2, '0');

export function PainelConferencia({ viagem, aoFechar, aoFinalizar }: PropsPainel & { aoFinalizar: () => void }) {
  const { finalizarViagem, registros, perfil } = useMotorista();
  const { erro, setErro, salvando, enviar } = useEnvio(aoFinalizar);
  const agora = new Date();
  const [kmFinal, setKmFinal] = useState('');
  const [data, setData] = useState(formatarData(hojeIso()));
  const [hora, setHora] = useState(`${dois(agora.getHours())}:${dois(agora.getMinutes())}`);
  const [local, setLocal] = useState(viagem.destino);
  const [observacoes, setObservacoes] = useState('');

  const comissionado = perfil.motorista?.modelo_remuneracao === 'comissionado';
  const cargas = registros.flatMap((r) =>
    r.tabela === 'complementos' && r.linha.viagem_id === viagem.id ? [r.linha.valor] : [],
  );
  const saldo = viagem.adiantamento_saldo;

  function confirmar() {
    const kmLido = lerDecimal(kmFinal);
    const dataIso = lerData(data);
    const horaOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
    if (kmLido === null || Number.isNaN(kmLido)) return setErro('Informe o km final.');
    if (viagem.km_inicial !== null && kmLido < viagem.km_inicial) {
      return setErro(`O km final não pode ser menor que o km inicial (${formatarKm(viagem.km_inicial)}).`);
    }
    if (!dataIso || !horaOk) return setErro('Data ou hora de chegada inválida.');
    const [ano, mes, dia] = dataIso.split('-').map(Number);
    const [h, min] = hora.split(':').map(Number);
    enviar(() =>
      finalizarViagem(viagem, {
        km_final: kmLido,
        data_hora_chegada: new Date(ano, mes - 1, dia, h, min).toISOString(),
        local_chegada: local.trim() || null,
        observacoes_finais: observacoes.trim() || null,
      }),
    );
  }

  return (
    <Moldura titulo="Conferência final" erro={erro} aoFechar={aoFechar}>
      <Aviso tipo="sucesso">Canhoto anexado. A documentação obrigatória está completa.</Aviso>

      {/* Motorista vê frete e a própria comissão; nunca a margem da empresa (spec do gestor 6.6) */}
      {comissionado ? (
        <View style={em.grade}>
          <View style={em.metade}>
            <ValorCalculado
              rotulo="Frete"
              valor={formatarMoeda(viagem.valor_frete_total)}
              nota={cargas.length > 0 ? `Inclui ${formatarMoeda(somar(cargas))} de carga complementar.` : undefined}
            />
          </View>
          <View style={em.metade}>
            <ValorCalculado
              rotulo="Sua comissão"
              valor={formatarMoeda(viagem.comissao_valor)}
              nota={`${formatarDecimal(viagem.comissao_percentual)}% do frete`}
            />
          </View>
        </View>
      ) : null}

      {viagem.valor_adiantamento > 0 || viagem.gasto_proprio_bolso > 0 ? (
        <View style={styles.prestacao}>
          <Text style={styles.rotulo}>Prestação de contas</Text>
          <Dado rotulo="Adiantamento recebido" valor={formatarMoeda(viagem.valor_adiantamento)} />
          <Dado rotulo="Total gasto com adiantamento" valor={formatarMoeda(viagem.adiantamento_gasto)} />
          <Dado
            rotulo={saldo >= 0 ? 'Saldo a devolver à empresa' : 'Saldo a reembolsar ao motorista'}
            valor={formatarMoeda(Math.abs(saldo))}
          />
          {viagem.gasto_proprio_bolso > 0 ? (
            <Dado rotulo="Pago do próprio bolso (a reembolsar)" valor={formatarMoeda(viagem.gasto_proprio_bolso)} />
          ) : null}
        </View>
      ) : null}

      <ValorCalculado rotulo="Km inicial" valor={formatarKm(viagem.km_inicial)} trancado />
      <Campo rotulo="Km final" value={kmFinal} onChangeText={setKmFinal} {...numerico} />
      <View style={em.grade}>
        <View style={em.metade}>
          <CampoData
            rotulo="Data de chegada"
            valor={data}
            onChange={setData}
          />
        </View>
        <View style={em.metade}>
          <Campo rotulo="Hora" value={hora} onChangeText={setHora} placeholder="hh:mm" maxLength={5} />
        </View>
      </View>
      <Campo rotulo="Local de chegada" value={local} onChangeText={setLocal} />
      <Campo rotulo="Observações finais (opcional)" value={observacoes} onChangeText={setObservacoes} multiline />
      <Botao titulo="Confirmar finalização" variante="perigo" onPress={confirmar} carregando={salvando} />
    </Moldura>
  );
}

const styles = StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Espaco.md },
  rotulo: { fontSize: 14, fontWeight: '600', color: Cores.texto },
  caixa: { flexDirection: 'row', alignItems: 'center', gap: Espaco.md, minHeight: 44 },
  quadrado: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Cores.borda,
    borderRadius: 6,
    backgroundColor: Cores.branco,
  },
  quadradoMarcado: { borderColor: Cores.primaria, backgroundColor: Cores.primaria },
  visto: { color: Cores.branco, fontWeight: '700' },
  estrela: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  estrelaTexto: { fontSize: 32, color: Cores.borda },
  estrelaCheia: { color: Cores.avisoForte },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: Espaco.md, paddingVertical: Espaco.xs },
  prestacao: { padding: Espaco.md, borderWidth: 1, borderColor: Cores.borda, borderRadius: Raio.sm },
});
