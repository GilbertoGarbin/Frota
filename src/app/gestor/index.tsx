import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { useSessao } from '@/context/SessaoContext';

// Provisória — será substituída pela Visão Geral do painel (Tela 2 da spec do gestor).
export default function GestorInicio() {
  const { acesso, email, sair } = useSessao();
  return (
    <Tela
      titulo={acesso?.tenantNome ?? 'Frota'}
      subtitulo={`Olá, ${acesso?.nome || email || 'gestor'}.`}>
      <Aviso tipo="info">O painel do gestor ainda está em construção.</Aviso>
      <Botao titulo="Sair" variante="contorno" onPress={sair} />
    </Tela>
  );
}
