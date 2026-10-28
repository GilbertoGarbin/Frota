import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { FormFormaRecebimento } from '@/components/gestor/forma-recebimento';
import { Botao } from '@/components/ui/botao';
import { BotaoIcone } from '@/components/ui/botao-icone';
import { Campo } from '@/components/ui/campo';
import { CampoBusca } from '@/components/ui/campo-busca';
import { Janela } from '@/components/ui/janela';
import { LinhaForm } from '@/components/ui/linha-form';
import { Mensagem, type ConteudoMensagem } from '@/components/ui/mensagem';
import { Segmentado } from '@/components/ui/segmentado';
import { Seletor } from '@/components/ui/seletor';
import { Selo } from '@/components/ui/selo';
import { Tabela, type Coluna } from '@/components/ui/tabela';
import { Cores, Espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { listarClientes, salvarCliente, type Cliente } from '@/services/clientes.service';
import {
  descreverParcelas,
  listarFormasRecebimento,
  type FormaRecebimento,
} from '@/services/formas-recebimento.service';
import { formatarDocumento, soDigitos } from '@/utils/cpf';
import { mensagemDeErro } from '@/utils/erros';
import { formatarTelefone } from '@/utils/formato';

const SITUACAO = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'inativo', rotulo: 'Inativo' },
] as const;

// Clientes (embarcadores). Cadastro simples: a viagem também aceita só o nome digitado,
// para o frete avulso (ex.: uma mudança) que não vale cadastrar.
async function carregarTela() {
  const [clientes, formas] = await Promise.all([listarClientes(), listarFormasRecebimento()]);
  return { clientes, formas };
}

export default function Clientes() {
  const { dados: tela, erro, recarregar } = useCarregar(carregarTela);
  const dados = tela?.clientes;
  // undefined = só a lista; null = novo cliente; Cliente = editando
  const [editando, setEditando] = useState<Cliente | null | undefined>(undefined);
  const [busca, setBusca] = useState('');

  const termo = busca.trim().toLowerCase();
  const digitosBusca = soDigitos(busca);
  const visiveis = (dados ?? []).filter(
    (c) =>
      !termo ||
      [c.nome, c.cidade ?? ''].join(' ').toLowerCase().includes(termo) ||
      (digitosBusca.length >= 3 && (c.documento ?? '').includes(digitosBusca)),
  );

  const colunas: Coluna<Cliente>[] = [
    { titulo: 'Nome', flex: 2, celula: (c) => c.nome },
    { titulo: 'CPF / CNPJ', flex: 1.15, celula: (c) => (c.documento ? formatarDocumento(c.documento) : '—') },
    { titulo: 'Telefone', celula: (c) => (c.telefone ? formatarTelefone(c.telefone) : '—') },
    { titulo: 'Cidade', celula: (c) => c.cidade ?? '—' },
    {
      titulo: 'Recebimento',
      flex: 2,
      celula: (c) => tela?.formas.find((f) => f.id === c.forma_recebimento_id)?.nome ?? '—',
    },
    {
      titulo: 'Situação',
      flex: 0.7,
      celula: (c) => (c.ativo ? <Selo tipo="sucesso">Ativo</Selo> : <Selo tipo="neutro">Inativo</Selo>),
    },
  ];

  return (
    <Pagina
      titulo="Clientes"
      acao={
        <View style={styles.acoes}>
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Nome, cidade ou CPF/CNPJ" />
          <Botao titulo="+ Novo cliente" compacto onPress={() => setEditando(null)} desativado={!dados} />
        </View>
      }>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {dados ? (
        <Tabela
          aoTocar={setEditando}
          colunas={colunas}
          itens={visiveis}
          chave={(c) => c.id}
          vazio={dados.length === 0 ? 'Nenhum cliente cadastrado ainda.' : 'Nenhum cliente encontrado.'}
          larguraMinima={980}
        />
      ) : erro ? null : (
        <ActivityIndicator color={Cores.primaria} />
      )}
      {editando !== undefined && tela ? (
        <FormCliente
          cliente={editando}
          formas={tela.formas}
          aoRecarregarFormas={recarregar}
          aoFechar={(salvou) => {
            setEditando(undefined);
            if (salvou) recarregar();
          }}
        />
      ) : null}
    </Pagina>
  );
}

type PropsForm = {
  cliente: Cliente | null;
  formas: FormaRecebimento[];
  aoRecarregarFormas: () => void;
  aoFechar: (salvou: boolean) => void;
};

const SEM_FORMA = 'nenhuma';

function FormCliente({ cliente, formas, aoRecarregarFormas, aoFechar }: PropsForm) {
  const [nome, setNome] = useState(cliente?.nome ?? '');
  const [documento, setDocumento] = useState(formatarDocumento(cliente?.documento ?? ''));
  const [telefone, setTelefone] = useState(formatarTelefone(cliente?.telefone ?? ''));
  const [cidade, setCidade] = useState(cliente?.cidade ?? '');
  const [situacao, setSituacao] = useState<'ativo' | 'inativo'>(cliente && !cliente.ativo ? 'inativo' : 'ativo');
  const [formaId, setFormaId] = useState(cliente?.forma_recebimento_id ?? SEM_FORMA);
  const [criandoForma, setCriandoForma] = useState(false);
  // forma criada agora ainda não está na lista recebida: mostra pelo nome provisório
  const [formasExtras, setFormasExtras] = useState<{ valor: string; rotulo: string }[]>([]);
  const opcoesForma = [
    { valor: SEM_FORMA, rotulo: 'Não definida' },
    ...formas.filter((f) => f.ativo || f.id === cliente?.forma_recebimento_id).map((f) => ({ valor: f.id, rotulo: f.nome })),
    ...formasExtras.filter((e) => !formas.some((f) => f.id === e.valor)),
  ];
  const formaEscolhida = formas.find((f) => f.id === formaId);
  const [mensagem, setMensagem] = useState<ConteudoMensagem | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return setMensagem({ titulo: 'Preencha os campos obrigatórios', itens: ['Nome'] });
    const doc = soDigitos(documento);
    if (doc && doc.length !== 11 && doc.length !== 14) {
      return setMensagem({ titulo: 'Confira o cadastro', texto: 'CPF tem 11 números e CNPJ tem 14.' });
    }
    setSalvando(true);
    try {
      await salvarCliente(cliente?.id ?? null, {
        nome: nome.trim(),
        documento: doc || null,
        telefone: soDigitos(telefone) || null,
        cidade: cidade.trim() || null,
        ativo: situacao === 'ativo',
        forma_recebimento_id: formaId === SEM_FORMA ? null : formaId,
      });
      aoFechar(true);
    } catch (e) {
      setMensagem({ titulo: 'Não foi possível salvar', texto: mensagemDeErro(e) });
      setSalvando(false);
    }
  }

  return (
    <Janela visivel titulo={cliente ? 'Editar cliente' : 'Novo cliente'} aoFechar={() => aoFechar(false)}>
      <Mensagem mensagem={mensagem} aoFechar={() => setMensagem(null)} />
      <LinhaForm minimo={240}>
        <Campo rotulo="Nome *" value={nome} onChangeText={setNome} placeholder="Ex.: Cooperativa Agrícola" />
        <Campo
          rotulo="CPF ou CNPJ"
          value={documento}
          onChangeText={(t) => setDocumento(formatarDocumento(t))}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={18}
        />
      </LinhaForm>
      <LinhaForm minimo={240}>
        <Campo
          rotulo="Telefone"
          value={telefone}
          onChangeText={(t) => setTelefone(formatarTelefone(t))}
          keyboardType="phone-pad"
          inputMode="tel"
          placeholder="(00) 00000-0000"
          maxLength={15}
        />
        <Campo rotulo="Cidade" value={cidade} onChangeText={setCidade} placeholder="Ex.: Pato Branco/PR" />
      </LinhaForm>
      <View style={styles.formaLinha}>
        <View style={styles.formaCampo}>
          <Seletor
            rotulo="Forma de recebimento"
            opcoes={opcoesForma}
            valor={formaId}
            onChange={setFormaId}
            ajuda={formaEscolhida ? descreverParcelas(formaEscolhida.parcelas) : 'Vem marcada nas viagens deste cliente.'}
          />
        </View>
        <View style={styles.formaMais}>
          <BotaoIcone icone="plus" rotulo="Cadastrar forma de recebimento" onPress={() => setCriandoForma(true)} />
        </View>
      </View>
      {cliente ? <Segmentado rotulo="Situação" opcoes={SITUACAO} valor={situacao} onChange={setSituacao} /> : null}
      <Text style={styles.nota}>Cliente inativo não aparece na lista ao criar viagem.</Text>
      <View style={styles.botoes}>
        <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
        <Botao titulo="Cancelar" variante="link" onPress={() => aoFechar(false)} />
      </View>
      {criandoForma ? (
        <FormFormaRecebimento
          forma={null}
          aoFechar={(id) => {
            setCriandoForma(false);
            if (id) {
              setFormasExtras((l) => [...l, { valor: id, rotulo: 'Forma nova' }]);
              setFormaId(id);
              aoRecarregarFormas();
            }
          }}
        />
      ) : null}
    </Janela>
  );
}

const styles = StyleSheet.create({
  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Espaco.sm,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  nota: { fontSize: 11, color: Cores.textoSuave },
  formaLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: Espaco.sm },
  formaCampo: { flex: 1, minWidth: 0 },
  formaMais: { paddingTop: 22 },
});
