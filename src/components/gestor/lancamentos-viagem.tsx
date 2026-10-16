import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CamposPagamento, dadosDoPagamento } from '@/components/campos-pagamento';
import { CampoAnexo } from '@/components/motorista/base';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { CampoData } from '@/components/ui/campo-data';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Seletor } from '@/components/ui/seletor';
import { CATEGORIAS_DESPESA, COMBUSTIVEIS, PAGAMENTOS, type Combustivel } from '@/constants/lancamentos';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';
import type { Anexo } from '@/services/anexo.service';
import {
  enviarDocumentoGestor,
  lancarAbastecimentoGestor,
  lancarDespesaGestor,
  type TipoDocumento,
} from '@/services/lancamentos-gestor.service';
import type { FormaPagamento, Viagem } from '@/services/viagens.service';
import { totalAbastecimento } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import {
  formatarData,
  formatarMoeda,
  hojeIso,
  lerData,
  lerDecimal,
  mascararDecimal,
  mascararInteiro,
} from '@/utils/formato';

// Formulários do gestor dentro do detalhe da viagem: abrem no próprio bloco (Abastecimentos,
// Despesas, Documentos) e fecham ao salvar.

type PropsForm = { viagem: Viagem; aoSalvar: () => void; aoCancelar: () => void };

const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
] as const;

const TIPOS_DOCUMENTO: { valor: TipoDocumento; rotulo: string }[] = [
  { valor: 'canhoto', rotulo: 'Canhoto' },
  { valor: 'cte', rotulo: 'CT-e' },
  { valor: 'nota_fiscal', rotulo: 'Nota fiscal' },
  { valor: 'comprovante', rotulo: 'Comprovante' },
  { valor: 'outro', rotulo: 'Outro' },
];

const preenchidos = (lista: (string | false)[]) => lista.filter((item): item is string => !!item);

/** Envia o formulário: avisos e erros na janelinha, botão com "carregando". */
function useEnvio(aoSalvar: () => void) {
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const [salvando, setSalvando] = useState(false);
  async function enviar(acao: () => Promise<void>) {
    setSalvando(true);
    try {
      await acao();
      aoSalvar();
    } catch (e) {
      setMensagem({ titulo: 'Não foi possível salvar', texto: mensagemDeErro(e) });
      setSalvando(false);
    }
  }
  return { mensagem, setMensagem, salvando, enviar };
}

function Moldura({ children, mensagem, aoFecharMensagem }: { children: ReactNode; mensagem: ConteudoMensagem | null; aoFecharMensagem: () => void }) {
  return (
    <View style={styles.moldura}>
      <Mensagem mensagem={mensagem} aoFechar={aoFecharMensagem} />
      {children}
    </View>
  );
}

function Botoes({ titulo, salvando, aoSalvar, aoCancelar }: { titulo: string; salvando: boolean; aoSalvar: () => void; aoCancelar: () => void }) {
  return (
    <View style={styles.botoes}>
      <Botao titulo={titulo} compacto onPress={aoSalvar} carregando={salvando} />
      <Botao titulo="Cancelar" variante="link" compacto onPress={aoCancelar} />
    </View>
  );
}

export function FormAbastecimentoGestor({ viagem, aoSalvar, aoCancelar }: PropsForm) {
  const { acesso } = useSessao();
  const { mensagem, setMensagem, salvando, enviar } = useEnvio(aoSalvar);
  const [data, setData] = useState(formatarData(hojeIso()));
  const [km, setKm] = useState('');
  const [litros, setLitros] = useState('');
  const [preco, setPreco] = useState('');
  const [combustivel, setCombustivel] = useState<Combustivel>('diesel_s10');
  const [pagamento, setPagamento] = useState<FormaPagamento | null>(null);
  const [cheio, setCheio] = useState<'sim' | 'nao'>('sim');
  const [posto, setPosto] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [anexo, setAnexo] = useState<Anexo | null>(null);

  const litrosLidos = lerDecimal(litros);
  const precoLido = lerDecimal(preco);
  const total = litrosLidos && precoLido ? totalAbastecimento(litrosLidos, precoLido) : null;

  function salvar() {
    const faltando = preenchidos([
      !data.trim() && 'Data',
      !km.trim() && 'Km do odômetro',
      !litros.trim() && 'Litros',
      !preco.trim() && 'Preço por litro',
      !pagamento && 'Forma de pagamento',
    ]);
    if (faltando.length > 0) return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: faltando });
    const invalido = (texto: string) => setMensagem({ titulo: 'Confira o abastecimento', texto });
    const dataIso = lerData(data);
    const kmLido = lerDecimal(km);
    if (!dataIso) return invalido('Data inválida. Use dia/mês/ano.');
    if (kmLido === null || Number.isNaN(kmLido)) return invalido('Km do odômetro inválido.');
    if (!litrosLidos || Number.isNaN(litrosLidos)) return invalido('Litros inválidos. Exemplo: 350,5');
    if (!precoLido || Number.isNaN(precoLido)) return invalido('Preço por litro inválido. Exemplo: 5,899');
    if (!pagamento || !acesso) return;
    const extra = dadosDoPagamento(pagamento, chavePix, vencimento);
    if (typeof extra === 'string') return invalido(extra);
    enviar(() =>
      lancarAbastecimentoGestor(
        acesso.tenantId,
        viagem,
        {
          data: dataIso,
          km: kmLido,
          litros: litrosLidos,
          preco_litro: precoLido,
          combustivel,
          forma_pagamento: pagamento,
          ...extra,
          tanque_cheio: cheio === 'sim',
          posto: posto.trim() || null,
        },
        anexo,
      ),
    );
  }

  return (
    <Moldura mensagem={mensagem} aoFecharMensagem={() => setMensagem(null)}>
      <LinhaForm minimo={160}>
        <CampoData rotulo="Data *" valor={data} onChange={setData} />
        <Campo
          rotulo="Km do odômetro *"
          value={km}
          onChangeText={(t) => setKm(mascararInteiro(t))}
          keyboardType="number-pad"
          inputMode="numeric"
        />
        <Campo rotulo="Litros *" value={litros} onChangeText={setLitros} keyboardType="numeric" inputMode="decimal" placeholder="Ex.: 350,5" />
        <Campo
          rotulo="Preço por litro (R$) *"
          value={preco}
          onChangeText={(t) => setPreco(mascararDecimal(t, 3))}
          keyboardType="numeric"
          inputMode="decimal"
          placeholder="Ex.: 5,899"
        />
      </LinhaForm>
      <Segmentado rotulo="Combustível" opcoes={COMBUSTIVEIS} valor={combustivel} onChange={setCombustivel} />
      <Segmentado rotulo="Forma de pagamento *" opcoes={PAGAMENTOS} valor={pagamento} onChange={setPagamento} />
      <CamposPagamento
        pagamento={pagamento}
        chavePix={chavePix}
        aoMudarChavePix={setChavePix}
        vencimento={vencimento}
        aoMudarVencimento={setVencimento}
      />
      <LinhaForm minimo={200}>
        <Segmentado rotulo="Tanque cheio?" opcoes={SIM_NAO} valor={cheio} onChange={setCheio} />
        <Campo rotulo="Posto (opcional)" value={posto} onChangeText={setPosto} />
        <View style={styles.total}>
          <Text style={styles.totalRotulo}>Total</Text>
          <Text style={styles.totalValor}>{total === null ? '—' : formatarMoeda(total)}</Text>
        </View>
      </LinhaForm>
      <CampoAnexo rotulo="Comprovante (opcional)" anexo={anexo} onChange={setAnexo} />
      <Botoes titulo="Lançar abastecimento" salvando={salvando} aoSalvar={salvar} aoCancelar={aoCancelar} />
    </Moldura>
  );
}

export function FormDespesaGestor({ viagem, aoSalvar, aoCancelar }: PropsForm) {
  const { acesso } = useSessao();
  const { mensagem, setMensagem, salvando, enviar } = useEnvio(aoSalvar);
  const [data, setData] = useState(formatarData(hojeIso()));
  const [categoria, setCategoria] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [pagamento, setPagamento] = useState<FormaPagamento | null>(null);
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [anexo, setAnexo] = useState<Anexo | null>(null);

  function salvar() {
    const faltando = preenchidos([
      !data.trim() && 'Data',
      !categoria && 'Categoria',
      !valor.trim() && 'Valor',
      !pagamento && 'Forma de pagamento',
    ]);
    if (faltando.length > 0) return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: faltando });
    const invalido = (texto: string) => setMensagem({ titulo: 'Confira a despesa', texto });
    const dataIso = lerData(data);
    const valorLido = lerDecimal(valor);
    if (!dataIso) return invalido('Data inválida. Use dia/mês/ano.');
    if (!valorLido || Number.isNaN(valorLido)) return invalido('Valor inválido.');
    if (!categoria || !pagamento || !acesso) return;
    const extra = dadosDoPagamento(pagamento, chavePix, vencimento);
    if (typeof extra === 'string') return invalido(extra);
    enviar(() =>
      lancarDespesaGestor(
        acesso.tenantId,
        viagem.id,
        {
          data: dataIso,
          categoria,
          valor: valorLido,
          forma_pagamento: pagamento,
          ...extra,
          local: local.trim() || null,
          descricao: descricao.trim() || null,
        },
        anexo,
      ),
    );
  }

  return (
    <Moldura mensagem={mensagem} aoFecharMensagem={() => setMensagem(null)}>
      <LinhaForm minimo={200}>
        <CampoData rotulo="Data *" valor={data} onChange={setData} />
        <Seletor rotulo="Categoria *" opcoes={CATEGORIAS_DESPESA} valor={categoria} onChange={setCategoria} />
        <Campo
          rotulo="Valor (R$) *"
          value={valor}
          onChangeText={(t) => setValor(mascararDecimal(t))}
          keyboardType="numeric"
          inputMode="decimal"
        />
      </LinhaForm>
      <Segmentado rotulo="Forma de pagamento *" opcoes={PAGAMENTOS} valor={pagamento} onChange={setPagamento} />
      <CamposPagamento
        pagamento={pagamento}
        chavePix={chavePix}
        aoMudarChavePix={setChavePix}
        vencimento={vencimento}
        aoMudarVencimento={setVencimento}
      />
      <LinhaForm minimo={260}>
        <Campo rotulo="Local / estabelecimento (opcional)" value={local} onChangeText={setLocal} />
        <Campo rotulo="Descrição (opcional)" value={descricao} onChangeText={setDescricao} />
      </LinhaForm>
      <CampoAnexo rotulo="Comprovante (opcional)" anexo={anexo} onChange={setAnexo} />
      <Botoes titulo="Lançar despesa" salvando={salvando} aoSalvar={salvar} aoCancelar={aoCancelar} />
    </Moldura>
  );
}

export function FormDocumentoGestor({ viagem, aoSalvar, aoCancelar }: PropsForm) {
  const { acesso } = useSessao();
  const { mensagem, setMensagem, salvando, enviar } = useEnvio(aoSalvar);
  const [tipo, setTipo] = useState<TipoDocumento | null>(null);
  const [anexo, setAnexo] = useState<Anexo | null>(null);

  function salvar() {
    const faltando = preenchidos([!tipo && 'Tipo de documento', !anexo && 'Arquivo (foto ou PDF)']);
    if (faltando.length > 0) return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: faltando });
    if (!tipo || !anexo || !acesso) return;
    enviar(() => enviarDocumentoGestor(acesso.tenantId, viagem.id, tipo, anexo));
  }

  return (
    <Moldura mensagem={mensagem} aoFecharMensagem={() => setMensagem(null)}>
      <Segmentado rotulo="Tipo de documento *" opcoes={TIPOS_DOCUMENTO} valor={tipo} onChange={setTipo} />
      <CampoAnexo rotulo="Arquivo * (foto ou PDF)" anexo={anexo} onChange={setAnexo} />
      <Botoes titulo="Enviar documento" salvando={salvando} aoSalvar={salvar} aoCancelar={aoCancelar} />
    </Moldura>
  );
}

const styles = StyleSheet.create({
  moldura: {
    gap: Espaco.md,
    padding: Espaco.lg,
    borderRadius: Raio.md,
    backgroundColor: Cores.fundo,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  // valor calculado: bloco de "resultado", nunca com cara de campo (spec, seção 2)
  total: { gap: 2, padding: Espaco.md, borderRadius: Raio.sm, backgroundColor: Cores.chipClaro },
  totalRotulo: { fontSize: 13, fontWeight: '600', color: Cores.primariaEscura },
  totalValor: { fontSize: 20, fontWeight: '700', color: Cores.primariaEscura },
});
