import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { useSessao } from '@/context/SessaoContext';

// Provisória — será substituída pelo Início do motorista (seção 5.1 da spec).
export default function MotoristaInicio() {
  const { acesso, sair } = useSessao();
  return (
    <Tela titulo={`Olá, ${acesso?.nome ?? 'motorista'}`} subtitulo={acesso?.tenantNome}>
      <Aviso tipo="info">O app do motorista ainda está em construção.</Aviso>
      <Botao titulo="Desvincular este aparelho" variante="contorno" onPress={sair} />
    </Tela>
  );
}
