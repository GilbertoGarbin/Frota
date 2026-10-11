// expo-secure-store não existe na web. O app do motorista é Android; isto só permite
// abrir o fluxo dele no navegador durante o desenvolvimento.
export const cofre = {
  ler: async (chave: string) => window.localStorage.getItem(chave),
  gravar: async (chave: string, valor: string) => window.localStorage.setItem(chave, valor),
  apagar: async (chave: string) => window.localStorage.removeItem(chave),
};
