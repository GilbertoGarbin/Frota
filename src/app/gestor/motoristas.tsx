import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Segmentado } from '@/components/ui/segmentado';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import {
  carregarTelaMotoristas,
  gerarCodigoAtivacao,
  revogarAparelho,
  salvarMotorista,
  type ModeloRemuneracao,
  type Motorista,
  type StatusMotorista,
} from '@/services/motoristas.service';
import type { Veiculo } from '@/services/veiculos.service';
import { cpfValido, formatarCpf, soDigitos } from '@/utils/cpf';
import { mensagemDeErro } from '@/utils/erros';
import {
  diasAte,
  formatarData,
  formatarDecimal,
  formatarTelefone,
  lerData,
  lerDecimal,
  mascararData,
} from '@/utils/formato';

const MODELOS: { valor: ModeloRemuneracao; rotulo: string }[] = [
  { valor: 'comissionado', rotulo: 'Comissionado' },
  { valor: 'assalariado', rotulo: 'Assalariado' },
];
const STATUS: { valor: StatusMotorista; rotulo: string }[] = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'inativo', rotulo: 'Inativo' },
];
const SEM_VEICULO = 'nenhum';
const ALERTA_CNH_DIAS = 30;

export default function Motoristas() {
  const { dados, erro, recarregar } = useCarregar(carregarTelaMotoristas);
  // undefined = lista; null = novo motorista; Motorista = editando
  const [editando, setEditando] = useState<Motorista | null | undefined>(undefined);

  if (editando !== undefined && dados) {
    return (
      <FormMotorista
        motorista={editando}
        veiculos={dados.veiculos}
        temAparelho={editando ? dados.comAparelho.has(editando.id) : false}
        aoMudarAparelho={recarregar}
        aoFechar={(salvou) => {
          setEditando(undefined);
          if (salvou) recarregar();
        }}
      />
    );
  }

  const placaDe = (id: string | null) => dados?.veiculos.find((v) => v.id === id)?.placa ?? '—';

  const colunas: Coluna<Motorista>[] = [
    { titulo: 'Nome', flex: 2, celula: (m) => m.nome },
    { titulo: 'Veículo', celula: (m) => placaDe(m.veiculo_vinculado_id) },
    {
      titulo: 'Remuneração',
      flex: 1.5,
      celula: (m) =>
        m.modelo_remuneracao === 'comissionado' ? (
          <Selo tipo="info">{`Comissionado · ${formatarDecimal(m.comissao_percentual)}%`}</Selo>
        ) : (
          <Selo tipo="neutro">Assalariado</Selo>
        ),
    },
    { titulo: 'CNH — validade', flex: 1.5, celula: (m) => <ValidadeCnh iso={m.cnh_validade} /> },
    {
      titulo: 'Aparelho',
      celula: (m) =>
        dados?.comAparelho.has(m.id) ? <Selo tipo="sucesso">Ativado</Selo> : <Selo tipo="neutro">Sem aparelho</Selo>,
    },
    {
      titulo: 'Status',
      celula: (m) =>
        m.status === 'ativo' ? <Selo tipo="sucesso">Ativo</Selo> : <Selo tipo="neutro">Inativo</Selo>,
    },
    {
      titulo: 'Ações',
      celula: (m) => <Botao titulo="Editar" variante="contorno" compacto onPress={() => setEditando(m)} />,
    },
  ];

  return (
    <Pagina
      titulo="Motoristas"
      subtitulo="Cadastro, remuneração e acesso ao app."
      acao={<Botao titulo="+ Novo motorista" compacto onPress={() => setEditando(null)} desativado={!dados} />}>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {dados ? (
        <Tabela
          colunas={colunas}
          itens={dados.motoristas}
          chave={(m) => m.id}
          vazio="Nenhum motorista cadastrado ainda."
          larguraMinima={980}
        />
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
    </Pagina>
  );
}

function ValidadeCnh({ iso }: { iso: string | null }) {
  if (!iso) return <Text style={styles.texto}>—</Text>;
  const dias = diasAte(iso);
  if (dias < 0) return <Selo tipo="perigo">{`Vencida em ${formatarData(iso)}`}</Selo>;
  if (dias <= ALERTA_CNH_DIAS) return <Selo tipo="aviso">{`Vence em ${dias} dia${dias === 1 ? '' : 's'}`}</Selo>;
  return <Text style={styles.texto}>{formatarData(iso)}</Text>;
}

type PropsForm = {
  motorista: Motorista | null;
  veiculos: Veiculo[];
  temAparelho: boolean;
  aoMudarAparelho: () => void;
  aoFechar: (salvou: boolean) => void;
};

function FormMotorista({ motorista, veiculos, temAparelho, aoMudarAparelho, aoFechar }: PropsForm) {
  const [nome, setNome] = useState(motorista?.nome ?? '');
  const [cpf, setCpf] = useState(formatarCpf(motorista?.cpf ?? ''));
  const [telefone, setTelefone] = useState(formatarTelefone(motorista?.telefone ?? ''));
  const [cnhNumero, setCnhNumero] = useState(motorista?.cnh_numero ?? '');
  const [cnhValidade, setCnhValidade] = useState(formatarData(motorista?.cnh_validade));
  const [veiculoId, setVeiculoId] = useState(motorista?.veiculo_vinculado_id ?? SEM_VEICULO);
  const [modelo, setModelo] = useState<ModeloRemuneracao>(
    (motorista?.modelo_remuneracao as ModeloRemuneracao) ?? 'comissionado',
  );
  const [comissao, setComissao] = useState(motorista ? formatarDecimal(motorista.comissao_percentual) : '');
  const [salario, setSalario] = useState(formatarDecimal(motorista?.salario_fixo));
  const [status, setStatus] = useState<StatusMotorista>((motorista?.status as StatusMotorista) ?? 'ativo');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Veículos ativos, mais o já vinculado (mesmo que tenha sido inativado depois)
  const opcoesVeiculo = [
    { valor: SEM_VEICULO, rotulo: 'Nenhum' },
    ...veiculos
      .filter((v) => v.status === 'ativo' || v.id === motorista?.veiculo_vinculado_id)
      .map((v) => ({ valor: v.id, rotulo: `${v.placa} · ${v.modelo}` })),
  ];

  async function aoSalvar() {
    const validade = lerData(cnhValidade);
    const percentual = modelo === 'comissionado' ? lerDecimal(comissao) : 0;
    const salarioFixo = modelo === 'assalariado' ? lerDecimal(salario) : null;

    if (!cpfValido(cpf)) return setErro('CPF inválido. Confira os números.');
    if (validade === undefined) return setErro('Validade da CNH inválida. Use dia/mês/ano.');
    if (percentual === null || Number.isNaN(percentual) || percentual > 100) {
      return setErro('Informe a comissão em %, de 0 a 100. Exemplo: 14');
    }
    if (Number.isNaN(salarioFixo)) return setErro('Salário fixo inválido.');

    setErro(null);
    setSalvando(true);
    try {
      await salvarMotorista(motorista?.id ?? null, {
        nome: nome.trim(),
        cpf: soDigitos(cpf),
        telefone: soDigitos(telefone) || null,
        cnh_numero: cnhNumero.trim() || null,
        cnh_validade: validade,
        veiculo_vinculado_id: veiculoId === SEM_VEICULO ? null : veiculoId,
        modelo_remuneracao: modelo,
        comissao_percentual: percentual,
        salario_fixo: salarioFixo,
        status,
      });
      aoFechar(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <Pagina titulo={motorista ? motorista.nome : 'Novo motorista'} estreita>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} autoComplete="name" />
      <Campo
        rotulo="CPF"
        ajuda="O motorista usa o CPF para ativar o app no celular."
        value={cpf}
        onChangeText={(t) => setCpf(formatarCpf(t))}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="000.000.000-00"
        maxLength={14}
      />
      <Campo
        rotulo="Telefone"
        value={telefone}
        onChangeText={(t) => setTelefone(formatarTelefone(t))}
        keyboardType="phone-pad"
        inputMode="tel"
        placeholder="(00) 00000-0000"
        maxLength={15}
      />
      <Campo rotulo="CNH — número" value={cnhNumero} onChangeText={setCnhNumero} keyboardType="number-pad" />
      <Campo
        rotulo="CNH — validade"
        value={cnhValidade}
        onChangeText={(t) => setCnhValidade(mascararData(t))}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
      />
      <Segmentado
        rotulo="Veículo vinculado"
        opcoes={opcoesVeiculo}
        valor={veiculoId}
        onChange={setVeiculoId}
        ajuda={veiculos.length === 0 ? 'Cadastre os veículos em “Veículos” para vincular.' : undefined}
      />
      <Segmentado rotulo="Modelo de remuneração" opcoes={MODELOS} valor={modelo} onChange={setModelo} />
      {modelo === 'comissionado' ? (
        <Campo
          rotulo="% Comissão"
          ajuda="Sobre o frete total de cada viagem. Mudar aqui não altera viagens já iniciadas."
          value={comissao}
          onChangeText={setComissao}
          keyboardType="numeric"
          inputMode="decimal"
          placeholder="Ex.: 14"
        />
      ) : (
        <Campo
          rotulo="Salário fixo (R$)"
          ajuda="Opcional. Ainda não é usado em nenhum cálculo."
          value={salario}
          onChangeText={setSalario}
          keyboardType="numeric"
          inputMode="decimal"
        />
      )}
      <Segmentado
        rotulo="Status"
        opcoes={STATUS}
        valor={status}
        onChange={setStatus}
        ajuda="Motorista inativo perde o acesso ao app."
      />
      <Botao
        titulo="Salvar"
        onPress={aoSalvar}
        carregando={salvando}
        desativado={!nome.trim() || soDigitos(cpf).length !== 11}
      />
      <Botao titulo="Voltar" variante="link" onPress={() => aoFechar(false)} />

      {motorista ? (
        <AcessoAoApp motorista={motorista} temAparelho={temAparelho} aoMudar={aoMudarAparelho} />
      ) : (
        <Aviso tipo="info">Depois de salvar, abra o motorista de novo para gerar o código de ativação do app.</Aviso>
      )}
    </Pagina>
  );
}

type PropsAcesso = { motorista: Motorista; temAparelho: boolean; aoMudar: () => void };

// Código de ativação e revogação do aparelho (decisao_stack_infra.md §2.4)
function AcessoAoApp({ motorista, temAparelho, aoMudar }: PropsAcesso) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoRevogar, setConfirmandoRevogar] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
    setOcupado(false);
  }

  const aoGerar = () => executar(async () => setCodigo(await gerarCodigoAtivacao(motorista.id)));
  const aoRevogar = () =>
    executar(async () => {
      await revogarAparelho(motorista.id);
      setCodigo(null);
      setConfirmandoRevogar(false);
      aoMudar();
    });

  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>Acesso ao app</Text>
      {temAparelho ? (
        <Selo tipo="sucesso">Aparelho ativado</Selo>
      ) : (
        <Selo tipo="neutro">Nenhum aparelho ativado</Selo>
      )}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      {motorista.status !== 'ativo' ? (
        <Aviso tipo="info">Motorista inativo não acessa o app. Ative o cadastro para gerar um código.</Aviso>
      ) : codigo ? (
        <View style={styles.codigoCaixa}>
          <Text style={styles.codigoRotulo}>Código de ativação</Text>
          <Text accessibilityLabel={`Código ${codigo}`} style={styles.codigo}>
            {codigo.slice(0, 3)} {codigo.slice(3)}
          </Text>
          <Text style={styles.codigoAjuda}>
            Passe este código ao motorista. No celular, ele abre o app, toca em “Sou motorista” e informa o
            CPF e o código. Vale 48 horas, só pode ser usado uma vez e não será mostrado de novo.
          </Text>
        </View>
      ) : (
        <Botao
          titulo={temAparelho ? 'Gerar código para outro aparelho' : 'Gerar código de ativação'}
          variante="contorno"
          onPress={aoGerar}
          carregando={ocupado}
        />
      )}
      {temAparelho && !codigo && motorista.status === 'ativo' ? (
        <Text style={styles.codigoAjuda}>Ativar outro aparelho desliga o atual.</Text>
      ) : null}

      {temAparelho ? (
        confirmandoRevogar ? (
          <>
            <Aviso tipo="erro">
              O motorista perde o acesso ao app neste aparelho na hora. Para voltar, será preciso um novo código.
            </Aviso>
            <Botao titulo="Revogar aparelho" variante="perigo" onPress={aoRevogar} carregando={ocupado} />
            <Botao titulo="Cancelar" variante="link" onPress={() => setConfirmandoRevogar(false)} />
          </>
        ) : (
          <Botao titulo="Revogar aparelho" variante="link" onPress={() => setConfirmandoRevogar(true)} />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  texto: { fontSize: 14, color: Cores.texto },
  secao: {
    gap: Espaco.md,
    marginTop: Espaco.lg,
    paddingTop: Espaco.xl,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
  },
  secaoTitulo: { fontSize: 18, fontWeight: '700', color: Cores.texto },
  codigoCaixa: { gap: Espaco.sm, padding: Espaco.lg, borderRadius: Raio.md, backgroundColor: Cores.chipClaro },
  codigoRotulo: { fontSize: 13, fontWeight: '600', color: Cores.primariaEscura },
  codigo: { fontSize: 36, fontWeight: '700', letterSpacing: 4, color: Cores.primariaEscura },
  codigoAjuda: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
});
