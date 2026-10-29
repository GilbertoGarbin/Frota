import { supabase } from '@/lib/supabase';

/** Configurações da transportadora (tela Configurações, só o admin altera). */
export type Configuracoes = {
  /** padrão das viagens novas: exigir o canhoto para finalizar */
  exigeCanhoto: boolean;
};

export async function carregarConfiguracoes(): Promise<Configuracoes> {
  const { data, error } = await supabase.rpc('minhas_configuracoes');
  if (error) throw error;
  return { exigeCanhoto: data?.[0]?.exige_canhoto ?? true };
}

export async function salvarConfiguracoes(c: Configuracoes): Promise<void> {
  const { error } = await supabase.rpc('salvar_configuracoes', { p_exige_canhoto: c.exigeCanhoto });
  if (error) throw error;
}
