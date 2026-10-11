import { useRouter } from 'expo-router';

import { Pagina } from '@/components/gestor/pagina';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { useSessao } from '@/context/SessaoContext';

// Provisória — será substituída pela Visão Geral do painel (Tela 2 da spec do gestor).
export default function GestorInicio() {
  const router = useRouter();
  const { acesso, email } = useSessao();
  return (
    <Pagina titulo="Visão Geral" subtitulo={`Olá, ${acesso?.nome || email || 'gestor'}.`} estreita>
      <Aviso tipo="info">
        Os indicadores e alertas ainda estão em construção. Comece cadastrando os veículos e depois os
        motoristas.
      </Aviso>
      <Botao titulo="Cadastrar veículos" onPress={() => router.navigate('/gestor/veiculos')} />
      <Botao titulo="Cadastrar motoristas" variante="contorno" onPress={() => router.navigate('/gestor/motoristas')} />
    </Pagina>
  );
}
