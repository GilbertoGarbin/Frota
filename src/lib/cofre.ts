import * as SecureStore from 'expo-secure-store';

// Armazenamento protegido do aparelho (Keystore no Android). Na web: cofre.web.ts.
export const cofre = {
  ler: (chave: string) => SecureStore.getItemAsync(chave),
  gravar: (chave: string, valor: string) => SecureStore.setItemAsync(chave, valor),
  apagar: (chave: string) => SecureStore.deleteItemAsync(chave),
};
