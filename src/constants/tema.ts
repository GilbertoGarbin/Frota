// Paleta das especificações (docs/especificacao_revisada_*.md, seção 3).
// Contraste já validado lá — não usar verde/vermelho saturado como fundo de texto branco.
export const Cores = {
  primaria: '#0066FF',
  primariaEscura: '#0C447C',
  chipClaro: '#EFF6FF',
  sucesso: '#00B87C',
  sucessoFundo: '#E3F7EF',
  sucessoTexto: '#00694A',
  avisoFundo: '#FAEEDA',
  avisoTexto: '#633806',
  avisoForte: '#854F0B',
  perigo: '#A32D2D',
  perigoFundo: '#FCEBEB',
  perigoTexto: '#791F1F',
  texto: '#1E293B',
  textoSuave: '#64748B',
  fundo: '#F8FAFC',
  borda: '#E2E8F0',
  branco: '#FFFFFF',
} as const;

export const Espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const Raio = { sm: 8, md: 12 } as const;
