import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Tela } from '@/components/ui/tela';
import { useSessao } from '@/context/SessaoContext';
import { armazem } from '@/db/armazem';
import { ativarAparelho } from '@/services/auth.service';
import { mensagemDeErro } from '@/utils/erros';
import { apagarPin } from '@/services/pin.service';
import { cpfValido, formatarCpf, soDigitos } from '@/utils/cpf';

const TAMANHO_CODIGO = 6;

// Motorista: vincula este aparelho com CPF + código gerado pelo gestor (uma vez só).
export default function Ativar() {
  const router = useRouter();
  const { recarregarAcesso, sair } = useSessao();
  const [cpf, setCpf] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoAtivar() {
    if (!cpfValido(cpf)) {
      setErro('CPF inválido. Confira os números.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      if (await ativarAparelho(cpf, codigo)) {
        await apagarPin(); // aparelho recém-ativado sempre cria um PIN novo
        await armazem.limpar(); // e não herda dados de outro motorista
        await recarregarAcesso();
        return;
      }
      setErro('CPF ou código não conferem. Se o erro continuar, peça um código novo ao gestor.');
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
    setEnviando(false);
  }

  // Encerra a sessão anônima do aparelho (se uma tentativa já a abriu) antes de ir ao login
  async function aoVoltarParaLogin() {
    await sair();
    router.replace('/entrar');
  }

  return (
    <Tela
      titulo="Ativar este aparelho"
      subtitulo="Informe seu CPF e o código de ativação que o gestor da transportadora passou.">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="CPF"
        value={cpf}
        onChangeText={(t) => setCpf(formatarCpf(t))}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="000.000.000-00"
        maxLength={14}
      />
      <Campo
        rotulo="Código de ativação"
        ajuda="6 números. Vale por 48 horas e só pode ser usado uma vez."
        value={codigo}
        onChangeText={(t) => setCodigo(soDigitos(t).slice(0, TAMANHO_CODIGO))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={TAMANHO_CODIGO}
        onSubmitEditing={aoAtivar}
      />
      <Botao
        titulo="Ativar"
        onPress={aoAtivar}
        carregando={enviando}
        desativado={soDigitos(cpf).length !== 11 || codigo.length !== TAMANHO_CODIGO}
      />
      <Botao titulo="Sou gestor — entrar com e-mail" variante="link" onPress={aoVoltarParaLogin} />
    </Tela>
  );
}
