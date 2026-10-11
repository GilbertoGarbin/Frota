import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Tela } from '@/components/ui/tela';
import { entrar, mensagemDeErro } from '@/services/auth.service';

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEntrar() {
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      // a navegação acontece sozinha quando a sessão muda (ver _layout)
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <Tela titulo="Frota" subtitulo="Entre para gerenciar sua transportadora.">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      <Campo
        rotulo="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={aoEntrar}
      />
      <Botao
        titulo="Entrar"
        onPress={aoEntrar}
        carregando={enviando}
        desativado={!email.trim() || !senha}
      />
      <Botao titulo="Criar conta de gestor" variante="contorno" onPress={() => router.push('/cadastro')} />
      <Botao titulo="Sou motorista — ativar este aparelho" variante="link" onPress={() => router.push('/ativar')} />
    </Tela>
  );
}
