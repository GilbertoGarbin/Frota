import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Tela } from '@/components/ui/tela';
import { Cores } from '@/constants/tema';
import { useSessao } from '@/context/SessaoContext';
import {
  conferirPin,
  definirPin,
  PIN_MAX,
  PIN_MIN,
  pinValido,
  temPin,
} from '@/services/pin.service';
import { soDigitos } from '@/utils/cpf';

// Volta a pedir o PIN depois deste tempo com o app em segundo plano
const BLOQUEIO_APOS_MS = 5 * 60 * 1000;

/**
 * Tranca o app do motorista atrás do PIN local: pede para criar na primeira vez,
 * e para digitar a cada abertura ou após um tempo em segundo plano.
 */
export function PinPortao({ children }: PropsWithChildren) {
  const [existePin, setExistePin] = useState<boolean | null>(null);
  const [liberado, setLiberado] = useState(false);
  const saiuEm = useRef<number | null>(null);

  useEffect(() => {
    temPin().then(setExistePin);
  }, []);

  useEffect(() => {
    const ouvinte = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') {
        saiuEm.current ??= Date.now();
      } else {
        if (saiuEm.current && Date.now() - saiuEm.current > BLOQUEIO_APOS_MS) setLiberado(false);
        saiuEm.current = null;
      }
    });
    return () => ouvinte.remove();
  }, []);

  if (existePin === null) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={Cores.primaria} />
      </View>
    );
  }
  if (!existePin) {
    return (
      <CriarPin
        aoCriar={() => {
          setExistePin(true);
          setLiberado(true);
        }}
      />
    );
  }
  if (!liberado) return <DigitarPin aoLiberar={() => setLiberado(true)} />;
  return children;
}

function CampoPin(props: { rotulo: string; value: string; onChangeText: (t: string) => void; onSubmitEditing?: () => void; ajuda?: string }) {
  return (
    <Campo
      {...props}
      onChangeText={(t) => props.onChangeText(soDigitos(t).slice(0, PIN_MAX))}
      keyboardType="number-pad"
      inputMode="numeric"
      secureTextEntry
      maxLength={PIN_MAX}
    />
  );
}

function CriarPin({ aoCriar }: { aoCriar: () => void }) {
  const [pin, setPin] = useState('');
  const [repetido, setRepetido] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function aoSalvar() {
    if (pin !== repetido) {
      setErro('Os dois PINs não são iguais.');
      return;
    }
    setErro(null);
    setSalvando(true);
    await definirPin(pin);
    aoCriar();
  }

  return (
    <Tela
      titulo="Crie seu PIN"
      subtitulo="Você vai usar este PIN para abrir o app neste aparelho. Ele não é enviado pela internet.">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <CampoPin rotulo="PIN" ajuda={`De ${PIN_MIN} a ${PIN_MAX} números.`} value={pin} onChangeText={setPin} />
      <CampoPin rotulo="Repita o PIN" value={repetido} onChangeText={setRepetido} onSubmitEditing={aoSalvar} />
      <Botao
        titulo="Salvar PIN"
        onPress={aoSalvar}
        carregando={salvando}
        desativado={!pinValido(pin) || !pinValido(repetido)}
      />
    </Tela>
  );
}

function DigitarPin({ aoLiberar }: { aoLiberar: () => void }) {
  const { acesso, sair } = useSessao();
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [confirmandoEsqueci, setConfirmandoEsqueci] = useState(false);

  async function aoConferir() {
    setConferindo(true);
    const resultado = await conferirPin(pin);
    if (resultado.ok) {
      aoLiberar();
      return;
    }
    if (resultado.restantes === 0) {
      // PIN errado demais: desvincula o aparelho; o gestor precisa gerar outro código
      await sair();
      return;
    }
    setPin('');
    setErro(
      `PIN incorreto. ${resultado.restantes} tentativa${resultado.restantes === 1 ? '' : 's'} antes de bloquear o aparelho.`,
    );
    setConferindo(false);
  }

  return (
    <Tela titulo={`Olá, ${acesso?.nome ?? 'motorista'}`} subtitulo="Digite seu PIN para continuar.">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <CampoPin rotulo="PIN" value={pin} onChangeText={setPin} onSubmitEditing={aoConferir} />
      <Botao titulo="Entrar" onPress={aoConferir} carregando={conferindo} desativado={!pinValido(pin)} />
      {confirmandoEsqueci ? (
        <>
          <Aviso tipo="erro">
            Isso desvincula este aparelho. Para voltar a usar o app você vai precisar de um novo
            código de ativação do gestor.
          </Aviso>
          <Botao titulo="Desvincular e ativar de novo" variante="contorno" onPress={sair} />
          <Botao titulo="Cancelar" variante="link" onPress={() => setConfirmandoEsqueci(false)} />
        </>
      ) : (
        <Botao titulo="Esqueci meu PIN" variante="link" onPress={() => setConfirmandoEsqueci(true)} />
      )}
    </Tela>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Cores.fundo },
});
