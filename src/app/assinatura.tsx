import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { abrirWhatsAppAssinatura, WHATSAPP_ASSINATURA } from '@/constants/assinatura';
import { useSessao } from '@/context/SessaoContext';

// Avaliação ou assinatura vencida (já passou a carência) ou bloqueada pelo super admin.
// O servidor já fechou o acesso aos dados; nada é apagado.
export default function Assinatura() {
  const { acesso, recarregarAcesso, sair } = useSessao();
  if (!acesso) return null;
  const { status } = acesso.assinatura;

  if (acesso.papel === 'motorista') {
    return (
      <Tela titulo="Acesso suspenso" subtitulo={acesso.tenantNome}>
        <Aviso tipo="erro">
          O acesso da transportadora ao Frota está suspenso. Fale com o gestor. Seus lançamentos que ainda não
          foram enviados continuam guardados neste aparelho.
        </Aviso>
        <Botao titulo="Tentar de novo" variante="contorno" onPress={recarregarAcesso} />
        <Botao titulo="Sair" variante="link" onPress={sair} />
      </Tela>
    );
  }

  const titulo =
    status === 'trial'
      ? 'Período de avaliação encerrado'
      : status === 'bloqueado' || status === 'cancelado'
        ? 'Acesso bloqueado'
        : 'Assinatura vencida';

  return (
    <Tela titulo={titulo} subtitulo={acesso.tenantNome}>
      <Aviso tipo="info">
        Assine para continuar usando o Frota. Nenhum dado foi apagado: tudo volta como estava assim que a assinatura
        for liberada.
      </Aviso>
      {WHATSAPP_ASSINATURA ? (
        <Botao
          titulo="Assinar pelo WhatsApp"
          onPress={() => abrirWhatsAppAssinatura(acesso.tenantNome, acesso.tenantId)}
        />
      ) : null}
      <Botao titulo="Já paguei — verificar de novo" variante="contorno" onPress={recarregarAcesso} />
      <Botao titulo="Sair" variante="link" onPress={sair} />
    </Tela>
  );
}
