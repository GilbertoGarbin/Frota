import { useState } from 'react';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Tela } from '@/components/ui/tela';
import { useSessao } from '@/context/SessaoContext';
import { criarTransportadora } from '@/services/auth.service';
import { mensagemDeErro } from '@/utils/erros';

// Primeiro acesso do gestor: a conta existe, mas ainda não pertence a uma transportadora.
export default function Transportadora() {
  const { email, nomeCadastro, recarregarAcesso, sair } = useSessao();
  const [nome, setNome] = useState('');
  const [nomeUsuario, setNomeUsuario] = useState(nomeCadastro ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoCriar() {
    setErro(null);
    setEnviando(true);
    try {
      await criarTransportadora(nome, nomeUsuario);
      await recarregarAcesso();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Tela
      titulo="Sua transportadora"
      subtitulo="Falta só cadastrar a transportadora para começar a usar o painel.">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="Nome da transportadora"
        value={nome}
        onChangeText={setNome}
        autoComplete="organization"
      />
      <Campo
        rotulo="Seu nome"
        value={nomeUsuario}
        onChangeText={setNomeUsuario}
        autoComplete="name"
        onSubmitEditing={aoCriar}
      />
      <Botao titulo="Começar" onPress={aoCriar} carregando={enviando} desativado={!nome.trim()} />
      <Botao titulo={email ? `Sair (${email})` : 'Sair'} variante="link" onPress={sair} />
    </Tela>
  );
}
