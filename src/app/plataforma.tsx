import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Grade, Indicador } from '@/components/ui/cartao';
import { Selo, type TipoSelo } from '@/components/ui/selo';
import { Cores, Espaco, Raio } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';
import { useCarregar } from '@/hooks/use-carregar';
import { SENHA_MIN, type StatusAssinatura } from '@/services/auth.service';
import {
  ativarAssinatura,
  bloquearEmpresa,
  listarEmpresas,
  listarUsuariosDaEmpresa,
  tornarVitalicia,
  type Empresa,
  type UsuarioDaEmpresa,
} from '@/services/plataforma.service';
import { gerarSenhaTemporaria, redefinirSenha } from '@/services/usuarios.service';
import { formatarCpf } from '@/utils/cpf';
import { mensagemDeErro } from '@/utils/erros';
import { formatarData, formatarDataHora } from '@/utils/formato';

const STATUS: Record<StatusAssinatura, { rotulo: string; tipo: TipoSelo }> = {
  trial: { rotulo: 'Avaliação', tipo: 'info' },
  ativo: { rotulo: 'Ativa', tipo: 'sucesso' },
  inadimplente: { rotulo: 'Inadimplente', tipo: 'aviso' },
  bloqueado: { rotulo: 'Bloqueada', tipo: 'perigo' },
  cancelado: { rotulo: 'Cancelada', tipo: 'neutro' },
  vitalicio: { rotulo: 'Vitalícia', tipo: 'sucesso' },
};
const PAPEL = { admin: 'Admin', gestor: 'Gestor', motorista: 'Motorista' } as const;

// Super admin (dono do sistema): todas as transportadoras cadastradas, seus usuários e a assinatura.
// Mesmo modelo do Painel Admin do FLUXO.
export default function Plataforma() {
  const { sair } = useSessao();
  const { dados, erro, recarregar } = useCarregar(listarEmpresas);
  const [busca, setBusca] = useState('');

  const termo = busca.trim().toLowerCase();
  const empresas = (dados ?? []).filter(
    (e) =>
      !termo ||
      [e.nome, e.adminNome, e.adminEmail].some((t) => t?.toLowerCase().includes(termo)),
  );
  const contar = (f: (e: Empresa) => boolean) => String((dados ?? []).filter(f).length);

  return (
    <SafeAreaView style={styles.raiz}>
      <View style={styles.topo}>
        <View>
          <Text style={styles.topoTitulo}>Plataforma Frota</Text>
          <Text style={styles.topoSub}>Administração do sistema</Text>
        </View>
        <Botao titulo="Sair" variante="link" compacto onPress={sair} />
      </View>
      <ScrollView contentContainerStyle={styles.rolagem} keyboardShouldPersistTaps="handled">
        <View style={styles.conteudo}>
          {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
          <Grade>
            <Indicador rotulo="Transportadoras" valor={contar(() => true)} />
            <Indicador rotulo="Em avaliação" valor={contar((e) => e.status === 'trial' && e.liberada)} tom="destaque" />
            <Indicador
              rotulo="Pagantes"
              valor={contar((e) => (e.status === 'ativo' || e.status === 'vitalicio') && e.liberada)}
              tom="sucesso"
            />
            <Indicador rotulo="Sem acesso" valor={contar((e) => !e.liberada)} tom="perigo" />
          </Grade>
          <TextInput
            accessibilityLabel="Buscar"
            placeholder="Buscar por transportadora, nome ou e-mail do admin…"
            placeholderTextColor={Cores.textoSuave}
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.busca}
          />
          {!dados && !erro ? <ActivityIndicator color={Cores.primaria} /> : null}
          {dados && empresas.length === 0 ? (
            <Text style={styles.suave}>{termo ? 'Nada encontrado para a busca.' : 'Nenhuma transportadora ainda.'}</Text>
          ) : null}
          {empresas.map((e) => (
            <CartaoEmpresa key={e.id} empresa={e} aoMudar={recarregar} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function situacao(e: Empresa): string {
  if (e.status === 'vitalicio') return 'Sem data de fim';
  if (e.status === 'trial') {
    if (!e.trialExpiraEm) return 'Avaliação sem data de fim';
    return e.diasRestantes > 0
      ? `Avaliação até ${formatarData(e.trialExpiraEm)} (faltam ${e.diasRestantes} dias)`
      : `Avaliação venceu em ${formatarData(e.trialExpiraEm)}`;
  }
  if (e.pagoAte) {
    return e.diasRestantes > 0
      ? `Pago até ${formatarData(e.pagoAte)} (faltam ${e.diasRestantes} dias)`
      : `Venceu em ${formatarData(e.pagoAte)}`;
  }
  return '';
}

function CartaoEmpresa({ empresa: e, aoMudar }: { empresa: Empresa; aoMudar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmarBloqueio, setConfirmarBloqueio] = useState(false);
  const [usuariosAbertos, setUsuariosAbertos] = useState(false);
  const status = STATUS[e.status];

  async function executar(chave: string, acao: () => Promise<void>) {
    setErro(null);
    setOcupado(chave);
    try {
      await acao();
      setConfirmarBloqueio(false);
      aoMudar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
    setOcupado(null);
  }

  return (
    <View style={styles.cartao}>
      <View style={styles.linhaTopo}>
        <Text style={styles.nome} numberOfLines={1}>
          {e.nome}
        </Text>
        <Selo tipo={e.liberada ? status.tipo : 'perigo'}>{e.liberada ? status.rotulo : `${status.rotulo} · sem acesso`}</Selo>
      </View>
      <Text style={styles.texto}>
        {e.adminNome ?? 'Sem admin'}
        {e.adminEmail ? <Text style={styles.suave}>{` · ${e.adminEmail}`}</Text> : null}
      </Text>
      <Text style={styles.suave}>
        {`${e.qtdUsuarios} usuário(s) · ${e.qtdMotoristas} motorista(s) · ${e.qtdVeiculos} veículo(s) · `}
        {`cadastrada em ${formatarData(e.criadaEm)} · último login do admin: `}
        {e.adminUltimoLogin ? formatarDataHora(e.adminUltimoLogin) : 'nunca'}
      </Text>
      {situacao(e) ? <Text style={styles.suave}>{situacao(e)}</Text> : null}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      {confirmarBloqueio ? (
        <View style={styles.acoes}>
          <Text style={styles.texto}>Bloquear? Todos os usuários perdem o acesso na hora (nada é apagado).</Text>
          <Botao
            titulo="Bloquear"
            variante="perigo"
            compacto
            carregando={ocupado === 'bloquear'}
            onPress={() => executar('bloquear', () => bloquearEmpresa(e.id))}
          />
          <Botao titulo="Cancelar" variante="link" compacto onPress={() => setConfirmarBloqueio(false)} />
        </View>
      ) : (
        <View style={styles.acoes}>
          <Botao
            titulo="+30 dias"
            compacto
            carregando={ocupado === '30'}
            onPress={() => executar('30', () => ativarAssinatura(e.id, 30))}
          />
          <Botao
            titulo="+365 dias"
            compacto
            carregando={ocupado === '365'}
            onPress={() => executar('365', () => ativarAssinatura(e.id, 365))}
          />
          {e.status !== 'vitalicio' ? (
            <Botao
              titulo="Vitalícia"
              variante="contorno"
              compacto
              carregando={ocupado === 'vitalicio'}
              onPress={() => executar('vitalicio', () => tornarVitalicia(e.id))}
            />
          ) : null}
          {e.status !== 'bloqueado' ? (
            <Botao titulo="Bloquear" variante="link" compacto onPress={() => setConfirmarBloqueio(true)} />
          ) : null}
        </View>
      )}

      <View style={styles.divisor} />
      <Botao
        titulo={usuariosAbertos ? '▲ Ocultar usuários' : '▼ Ver usuários'}
        variante="link"
        compacto
        onPress={() => setUsuariosAbertos((v) => !v)}
      />
      {usuariosAbertos ? <UsuariosDaEmpresa tenantId={e.id} /> : null}
    </View>
  );
}

function UsuariosDaEmpresa({ tenantId }: { tenantId: string }) {
  const [buscar] = useState(() => () => listarUsuariosDaEmpresa(tenantId));
  const { dados, erro, recarregar } = useCarregar(buscar);
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados) return <ActivityIndicator color={Cores.primaria} />;
  if (dados.length === 0) return <Text style={styles.suave}>Nenhum usuário.</Text>;
  return (
    <View style={styles.usuarios}>
      {dados.map((u) => (
        <LinhaUsuario key={u.id} usuario={u} aoMudar={recarregar} />
      ))}
    </View>
  );
}

function LinhaUsuario({ usuario: u, aoMudar }: { usuario: UsuarioDaEmpresa; aoMudar: () => void }) {
  const [redefinindo, setRedefinindo] = useState(false);
  const [senha, setSenha] = useState('');
  const [pronta, setPronta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const login = u.papel === 'motorista' ? formatarCpf(u.login) : u.login;

  async function aoRedefinir() {
    if (senha.length < SENHA_MIN) return setErro(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
    setErro(null);
    setEnviando(true);
    try {
      await redefinirSenha(u.id, senha);
      setPronta(senha);
      setRedefinindo(false);
      aoMudar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
    setEnviando(false);
  }

  return (
    <View style={styles.usuario}>
      <View style={styles.usuarioLinha}>
        <View style={styles.usuarioInfo}>
          <View style={styles.selos}>
            <Text style={styles.usuarioNome}>{u.nome ?? '—'}</Text>
            <Selo tipo={u.papel === 'admin' ? 'info' : 'neutro'}>{PAPEL[u.papel]}</Selo>
            {u.primeiroAcesso ? <Selo tipo="aviso">Senha temporária</Selo> : null}
            {!u.ativo ? <Selo tipo="perigo">Desligado</Selo> : null}
          </View>
          <Text style={styles.suave}>
            {`${login} · último login: ${u.ultimoLogin ? formatarDataHora(u.ultimoLogin) : 'nunca'}`}
          </Text>
        </View>
        {!redefinindo ? (
          <Botao
            titulo="Redefinir senha"
            variante="contorno"
            compacto
            onPress={() => {
              setSenha(gerarSenhaTemporaria());
              setPronta(null);
              setRedefinindo(true);
            }}
          />
        ) : null}
      </View>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {redefinindo ? (
        <View style={styles.redefinir}>
          <Campo
            rotulo="Nova senha temporária"
            ajuda="No próximo login a pessoa é obrigada a criar uma senha nova."
            value={senha}
            onChangeText={setSenha}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.acoes}>
            <Botao titulo="Redefinir" compacto onPress={aoRedefinir} carregando={enviando} />
            <Botao titulo="Cancelar" variante="link" compacto onPress={() => setRedefinindo(false)} />
          </View>
        </View>
      ) : null}
      {pronta ? (
        <Aviso tipo="sucesso">{`Senha redefinida. Passe para ${u.nome ?? 'a pessoa'}: login ${login}, senha temporária ${pronta}`}</Aviso>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Cores.fundo },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Espaco.xl,
    paddingVertical: Espaco.md,
    backgroundColor: Cores.texto,
  },
  topoTitulo: { fontSize: 18, fontWeight: '700', color: Cores.branco },
  topoSub: { fontSize: 12, color: '#94A3B8' },
  rolagem: { flexGrow: 1, padding: Espaco.xl },
  conteudo: { width: '100%', maxWidth: 960, alignSelf: 'center', gap: Espaco.lg },
  busca: {
    minHeight: 48,
    paddingHorizontal: Espaco.md,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.sm,
    backgroundColor: Cores.branco,
    fontSize: 15,
    color: Cores.texto,
  },
  cartao: {
    gap: Espaco.sm,
    padding: Espaco.lg,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio.md,
    backgroundColor: Cores.branco,
  },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: Espaco.md },
  nome: { flex: 1, fontSize: 17, fontWeight: '700', color: Cores.texto },
  texto: { fontSize: 14, color: Cores.texto },
  suave: { fontSize: 13, lineHeight: 19, color: Cores.textoSuave },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.sm, marginTop: Espaco.xs },
  divisor: { height: 1, backgroundColor: Cores.borda, marginTop: Espaco.sm },
  usuarios: { gap: Espaco.sm },
  usuario: { gap: Espaco.sm, padding: Espaco.md, borderRadius: Raio.sm, backgroundColor: Cores.fundo },
  usuarioLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.md },
  usuarioInfo: { flex: 1, minWidth: 220, gap: 2 },
  selos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Espaco.sm },
  usuarioNome: { fontSize: 14, fontWeight: '600', color: Cores.texto },
  redefinir: { gap: Espaco.sm, maxWidth: 420 },
});
