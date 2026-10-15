import { Linking } from 'react-native';

// Assinatura por PIX manual, como no FLUXO: o cliente chama no WhatsApp, paga, e o super admin
// libera os dias na tela da plataforma.
// Número com DDI e DDD, só dígitos (ex.: 5546999998888). Vazio = esconde o botão do WhatsApp.
export const WHATSAPP_ASSINATURA = '';

export function abrirWhatsAppAssinatura(tenantNome: string, tenantId: string) {
  if (!WHATSAPP_ASSINATURA) return;
  const texto = `Olá! Quero assinar o Frota.\nTransportadora: ${tenantNome}\nCódigo: ${tenantId}`;
  return Linking.openURL(`https://wa.me/${WHATSAPP_ASSINATURA}?text=${encodeURIComponent(texto)}`);
}
