import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Seletor } from '@/components/ui/seletor';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';
import { useCarregar } from '@/hooks/use-carregar';
import {
  carregarTelaMotoristas,
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
  mascararDecimal,
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
        motoristas={dados.motoristas}
        temAcesso={editando ? dados.comAcesso.has(editando.id) : false}
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
      titulo: 'App',
      celula: (m) =>
        dados?.comAcesso.has(m.id) ? <Selo tipo="sucesso">Com acesso</Selo> : <Selo tipo="neutro">Sem acesso</Selo>,
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
  /** para esconder os caminhões que já estão com outro motorista ativo */
  motoristas: Motorista[];
  temAcesso: boolean;
  aoFechar: (salvou: boolean) => void;
};

function FormMotorista({ motorista, veiculos, motoristas, temAcesso, aoFechar }: PropsForm) {
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
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const [salvando, setSalvando] = useState(false);
  const comissionado = modelo === 'comissionado';

  // Caminhão com outro motorista ativo não aparece (o banco também impede)
  const ocupados = new Set(
    motoristas.flatMap((m) =>
      m.id !== motorista?.id && m.status === 'ativo' && m.veiculo_vinculado_id ? [m.veiculo_vinculado_id] : [],
    ),
  );
  // Veículos ativos e livres, mais o já vinculado (mesmo que tenha sido inativado depois)
  const opcoesVeiculo = [
    { valor: SEM_VEICULO, rotulo: 'Nenhum' },
    ...veiculos
      .filter((v) => (v.status === 'ativo' && !ocupados.has(v.id)) || v.id === motorista?.veiculo_vinculado_id)
      .map((v) => ({ valor: v.id, rotulo: `${v.placa} · ${v.modelo}` })),
  ];

  async function aoSalvar() {
    const validade = lerData(cnhValidade);
    const percentual = comissionado ? lerDecimal(comissao) : 0;
    const salarioFixo = comissionado ? null : lerDecimal(salario);

    const faltando = [
      !nome.trim() && 'Nome completo',
      !soDigitos(cpf) && 'CPF',
      comissionado && !comissao.trim() && '% Comissão',
    ].filter((item): item is string => !!item);
    if (faltando.length > 0) {
      return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: faltando });
    }
    const invalido = (texto: string) => setMensagem({ titulo: 'Confira o cadastro', texto });
    if (!cpfValido(cpf)) return invalido('CPF inválido. Confira os números.');
    if (validade === undefined) return invalido('Validade da CNH inválida. Use dia/mês/ano.');
    if (percentual === null || Number.isNaN(percentual) || percentual > 100) {
      return invalido('Informe a comissão em %, de 0 a 100. Exemplo: 14,00');
    }
    if (Number.isNaN(salarioFixo)) return invalido('Salário fixo inválido.');

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
      setMensagem({ titulo: 'Não foi possível salvar', texto: mensagemDeErro(e) });
      setSalvando(false);
    }
  }

  return (
    <Pagina
      titulo={motorista ? motorista.nome : 'Novo motorista'}
      subtitulo="Campos com * são obrigatórios."
      media>
      <Mensagem mensagem={mensagem} aoFechar={() => setMensagem(null)} />
      <LinhaForm minimo={280}>
        <Campo rotulo="Nome completo *" value={nome} onChangeText={setNome} autoComplete="name" />
        <Campo
          rotulo="CPF *"
          ajuda="O motorista entra no app (celular ou web) com o CPF e uma senha."
          value={cpf}
          onChangeText={(t) => setCpf(formatarCpf(t))}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="000.000.000-00"
          maxLength={14}
        />
      </LinhaForm>
      <LinhaForm minimo={200}>
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
      </LinhaForm>
      <Seletor
        rotulo="Veículo vinculado"
        opcoes={opcoesVeiculo}
        valor={veiculoId}
        onChange={setVeiculoId}
        ajuda={
          veiculos.length === 0
            ? 'Cadastre os veículos em “Veículos” para vincular.'
            : ocupados.size > 0
              ? 'Caminhões que já estão com outro motorista ativo não aparecem na lista.'
              : undefined
        }
      />
      <LinhaForm minimo={280}>
        <Segmentado rotulo="Modelo de remuneração" opcoes={MODELOS} valor={modelo} onChange={setModelo} />
        {comissionado ? (
          <Campo
            rotulo="% Comissão *"
            ajuda="Sobre o frete total de cada viagem. Mudar aqui não altera viagens já iniciadas."
            value={comissao}
            onChangeText={(t) => setComissao(mascararDecimal(t))}
            keyboardType="numeric"
            inputMode="decimal"
            placeholder="Ex.: 14,00"
          />
        ) : (
          <Campo
            rotulo="Salário fixo (R$)"
            ajuda="Opcional. Ainda não é usado em nenhum cálculo."
            value={salario}
            onChangeText={(t) => setSalario(mascararDecimal(t))}
            keyboardType="numeric"
            inputMode="decimal"
          />
        )}
      </LinhaForm>
      <Segmentado
        rotulo="Status"
        opcoes={STATUS}
        valor={status}
        onChange={setStatus}
        ajuda="Motorista inativo perde o acesso ao app."
      />
      <View style={styles.botoes}>
        <Botao titulo="Salvar" onPress={aoSalvar} carregando={salvando} />
        <Botao titulo="Voltar" variante="link" onPress={() => aoFechar(false)} />
      </View>

      <AcessoAoApp temAcesso={temAcesso} />
    </Pagina>
  );
}

// O login do motorista (CPF + senha) é criado pelo admin na tela Usuários.
function AcessoAoApp({ temAcesso }: { temAcesso: boolean }) {
  const router = useRouter();
  const { acesso } = useSessao();
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>Acesso ao app</Text>
      {temAcesso ? <Selo tipo="sucesso">Com acesso</Selo> : <Selo tipo="neutro">Sem acesso</Selo>}
      <Text style={styles.ajuda}>
        O motorista entra com o CPF e uma senha. O admin da transportadora cria o acesso, redefine a senha ou
        desliga o acesso na tela Usuários.
      </Text>
      {acesso?.papel === 'admin' ? (
        <Botao titulo="Ir para Usuários" variante="contorno" onPress={() => router.navigate('/gestor/usuarios')} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  texto: { fontSize: 14, color: Cores.texto },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  secao: {
    gap: Espaco.md,
    marginTop: Espaco.lg,
    paddingTop: Espaco.xl,
    borderTopWidth: 1,
    borderTopColor: Cores.borda,
  },
  secaoTitulo: { fontSize: 18, fontWeight: '700', color: Cores.texto },
  ajuda: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
});
