import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Janela } from '@/components/ui/janela';
import { CampoData } from '@/components/ui/campo-data';
import { Grade, Indicador } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { excluirCustoFixo, listarCustosFixos, salvarCustoFixo, type CustoFixo } from '@/services/gestao.service';
import { somar } from '@/utils/dinheiro';
import { mensagemDeErro } from '@/utils/erros';
import {
  formatarData,
  formatarDecimal,
  formatarMoeda,
  hojeIso,
  lerData,
  lerDecimal,
  mascararDecimal,
  mesAtual,
  periodoDoMes,
  rotuloMes,
} from '@/utils/formato';

/** O custo vale no mês? (compara por mês, como o banco faz no resumo financeiro) */
function vigenteNoMes(custo: CustoFixo, inicioMes: string, fimMes: string): boolean {
  return custo.inicio.slice(0, 7) <= fimMes.slice(0, 7) && (!custo.fim || custo.fim.slice(0, 7) >= inicioMes.slice(0, 7));
}

// Custos Fixos — despesas mensais recorrentes (seguro, parcela, rastreador, contador…)
export default function CustosFixos() {
  const { dados: custos, erro, recarregar } = useCarregar(listarCustosFixos);
  const [editando, setEditando] = useState<CustoFixo | null | undefined>(undefined);

  const formulario =
    editando !== undefined ? (
      <FormCustoFixo
        custo={editando}
        aoFechar={(salvou) => {
          setEditando(undefined);
          if (salvou) recarregar();
        }}
      />
    ) : null;

  const mes = mesAtual();
  const { inicio, fim } = periodoDoMes(mes);
  const vigentes = (custos ?? []).filter((c) => vigenteNoMes(c, inicio, fim));

  const colunas: Coluna<CustoFixo>[] = [
    { titulo: 'Descrição', flex: 2, celula: (c) => c.descricao },
    { titulo: 'Categoria', celula: (c) => c.categoria ?? '—' },
    { titulo: 'Valor mensal', celula: (c) => formatarMoeda(c.valor_mensal) },
    {
      titulo: 'Vigência',
      flex: 1.5,
      celula: (c) => `${formatarData(c.inicio).slice(3)} até ${c.fim ? formatarData(c.fim).slice(3) : 'sem data de fim'}`,
    },
    {
      titulo: 'Situação',
      celula: (c) =>
        vigenteNoMes(c, inicio, fim) ? <Selo tipo="sucesso">Vigente</Selo> : <Selo tipo="neutro">Fora do mês</Selo>,
    },
    {
      titulo: 'Ações',
      celula: (c) => <Botao titulo="Editar" variante="contorno" compacto onPress={() => setEditando(c)} />,
    },
  ];

  return (
    <Pagina
      titulo="Custos Fixos"
      subtitulo="Despesas mensais recorrentes da operação."
      acao={<Botao titulo="+ Novo custo fixo" compacto onPress={() => setEditando(null)} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {custos ? (
        <>
          <Grade>
            <Indicador
              rotulo={`Total em ${rotuloMes(mes)}`}
              tom="destaque"
              valor={formatarMoeda(somar(vigentes.map((c) => c.valor_mensal)))}
              detalhe={`${vigentes.length} custo(s) vigente(s) — entra no resultado líquido do mês`}
            />
          </Grade>
          <Tabela colunas={colunas} itens={custos} chave={(c) => c.id} vazio="Nenhum custo fixo cadastrado ainda." />
        </>
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
      {formulario}
    </Pagina>
  );
}

function FormCustoFixo({ custo, aoFechar }: { custo: CustoFixo | null; aoFechar: (salvou: boolean) => void }) {
  const [descricao, setDescricao] = useState(custo?.descricao ?? '');
  const [categoria, setCategoria] = useState(custo?.categoria ?? '');
  const [valor, setValor] = useState(custo ? formatarDecimal(custo.valor_mensal) : '');
  const [inicio, setInicio] = useState(formatarData(custo?.inicio ?? `${hojeIso().slice(0, 7)}-01`));
  const [fim, setFim] = useState(formatarData(custo?.fim));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setSalvando(true);
    try {
      await acao();
      aoFechar(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  function aoSalvar() {
    const valorLido = lerDecimal(valor);
    const inicioIso = lerData(inicio);
    const fimIso = lerData(fim);
    if (valorLido === null || Number.isNaN(valorLido) || valorLido <= 0) return setErro('Informe o valor mensal.');
    if (!inicioIso) return setErro('Data de início inválida. Use dia/mês/ano.');
    if (fimIso === undefined) return setErro('Data de fim inválida. Use dia/mês/ano.');
    if (fimIso && fimIso < inicioIso) return setErro('O fim não pode ser antes do início.');
    executar(() =>
      salvarCustoFixo(custo?.id ?? null, {
        descricao: descricao.trim(),
        categoria: categoria.trim() || null,
        valor_mensal: valorLido,
        inicio: inicioIso,
        fim: fimIso,
      }),
    );
  }

  return (
    <Janela visivel titulo={custo ? 'Editar custo fixo' : 'Novo custo fixo'} aoFechar={() => aoFechar(false)}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo rotulo="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Ex.: Seguro do caminhão" />
      <Campo rotulo="Categoria (opcional)" value={categoria} onChangeText={setCategoria} placeholder="Ex.: Seguro, Financiamento, Rastreador" />
      <Campo rotulo="Valor mensal (R$)" value={valor} onChangeText={(t) => setValor(mascararDecimal(t))} keyboardType="numeric" inputMode="decimal" />
      <CampoData
        rotulo="Vale a partir de"
        ajuda="O custo entra no resultado a partir do mês desta data."
        valor={inicio}
        onChange={setInicio}
      />
      <CampoData
        rotulo="Vale até (opcional)"
        ajuda="Deixe vazio se o custo continua. Preencha para encerrar (ex.: última parcela)."
        valor={fim}
        onChange={setFim}
      />
      <Botao titulo="Salvar" onPress={aoSalvar} carregando={salvando} desativado={!descricao.trim()} />
      <Botao titulo="Cancelar" variante="link" onPress={() => aoFechar(false)} />
      {custo ? (
        confirmandoExcluir ? (
          <Botao titulo="Confirmar exclusão" variante="perigo" onPress={() => executar(() => excluirCustoFixo(custo.id))} />
        ) : (
          <Botao titulo="Excluir custo fixo" variante="link" onPress={() => setConfirmandoExcluir(true)} />
        )
      ) : null}
    </Janela>
  );
}
