import { useState } from 'react';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Tela } from '@/components/ui/tela';
import { useSessao } from '@/context/SessaoContext';
import { SENHA_MIN, trocarSenha } from '@/services/auth.service';
import { mensagemDeErro } from '@/utils/erros';

// Primeiro login com a senha temporária que o admin criou (ou redefiniu): troca obrigatória.
export default function TrocarSenha() {
  const { acesso, recarregarAcesso, sair } = useSessao();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoSalvar() {
    if (senha.length < SENHA_MIN) return setErro(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.');
    setErro(null);
    setEnviando(true);
    try {
      await trocarSenha(senha);
      await recarregarAcesso();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Tela
      titulo={acesso?.nome ? `Olá, ${acesso.nome.split(' ')[0]}` : 'Crie sua senha'}
      subtitulo="Você entrou com uma senha temporária. Escolha uma senha só sua para continuar.">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="Nova senha"
        ajuda={`Mínimo de ${SENHA_MIN} caracteres.`}
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="new-password"
      />
      <Campo
        rotulo="Repita a nova senha"
        value={confirmacao}
        onChangeText={setConfirmacao}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={aoSalvar}
      />
      <Botao titulo="Salvar e continuar" onPress={aoSalvar} carregando={enviando} desativado={!senha || !confirmacao} />
      <Botao titulo="Sair" variante="link" onPress={sair} />
    </Tela>
  );
}
