import * as Crypto from 'expo-crypto';

import { cofre } from '@/lib/cofre';

// O PIN é só o desbloqueio local do app neste aparelho: nunca é enviado ao servidor.
// Guardamos o hash com sal no armazenamento protegido, junto com o contador de erros.

const CHAVE = 'frota.pin';
export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const PIN_MAX_ERROS = 5;

type Registro = { sal: string; hash: string; erros: number };

export type ResultadoPin =
  | { ok: true }
  | { ok: false; restantes: number }; // restantes 0 = bloqueado, precisa entrar de novo com CPF e senha

const hashDe = (sal: string, pin: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${sal}:${pin}`);

async function lerRegistro(): Promise<Registro | null> {
  const bruto = await cofre.ler(CHAVE);
  return bruto ? (JSON.parse(bruto) as Registro) : null;
}

export function pinValido(pin: string): boolean {
  return new RegExp(`^[0-9]{${PIN_MIN},${PIN_MAX}}$`).test(pin);
}

export async function temPin(): Promise<boolean> {
  return (await lerRegistro()) !== null;
}

export async function definirPin(pin: string): Promise<void> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const sal = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const registro: Registro = { sal, hash: await hashDe(sal, pin), erros: 0 };
  await cofre.gravar(CHAVE, JSON.stringify(registro));
}

export async function conferirPin(pin: string): Promise<ResultadoPin> {
  const registro = await lerRegistro();
  if (!registro || registro.erros >= PIN_MAX_ERROS) return { ok: false, restantes: 0 };

  if ((await hashDe(registro.sal, pin)) === registro.hash) {
    if (registro.erros > 0) await cofre.gravar(CHAVE, JSON.stringify({ ...registro, erros: 0 }));
    return { ok: true };
  }
  const erros = registro.erros + 1;
  await cofre.gravar(CHAVE, JSON.stringify({ ...registro, erros }));
  return { ok: false, restantes: PIN_MAX_ERROS - erros };
}

export async function apagarPin(): Promise<void> {
  await cofre.apagar(CHAVE);
}
