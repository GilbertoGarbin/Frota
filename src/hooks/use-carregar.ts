import { useCallback, useEffect, useState } from 'react';

import { mensagemDeErro } from '@/utils/erros';

/**
 * Carrega dados do servidor ao montar a tela e sempre que `recarregar` é chamado.
 * `buscar` precisa ser estável (função de módulo), senão recarrega a cada render.
 */
export function useCarregar<T>(buscar: () => Promise<T>) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string | null }>({
    dados: null,
    erro: null,
  });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vigente = true;
    buscar().then(
      (dados) => {
        if (vigente) setEstado({ dados, erro: null });
      },
      (e) => {
        if (vigente) setEstado((anterior) => ({ dados: anterior.dados, erro: mensagemDeErro(e) }));
      },
    );
    return () => {
      vigente = false;
    };
  }, [buscar, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { ...estado, recarregar };
}
