import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Cores } from '@/constants/tema';

// Um único conjunto de ícones de traço (outline), sempre de uma cor só — a spec do motorista
// (seção 1, item 3) pede isso para o app parecer um sistema único. Não misturar com emojis.
const GLIFOS = {
  abastecimento: 'gas-station-outline',
  despesa: 'receipt-text-outline',
  parada: 'parking',
  carga: 'package-variant-closed',
  documento: 'file-document-outline',
  cadeado: 'lock-outline',
  inicio: 'home-outline',
  lista: 'format-list-bulleted',
  perfil: 'account-outline',
} as const;

export type NomeIcone = keyof typeof GLIFOS;

export function Icone({ nome, tamanho = 22, cor = Cores.texto }: { nome: NomeIcone; tamanho?: number; cor?: string }) {
  return <MaterialCommunityIcons name={GLIFOS[nome]} size={tamanho} color={cor} />;
}
