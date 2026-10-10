# Frota

SaaS de gestão de micro-frotas: app do motorista (Android) e painel do gestor (web) em um único
projeto Expo, com Supabase como backend.

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a chave publishable do Supabase
npm run web                  # painel no navegador
npm run android              # app no Android
```

## Build

- Web: `npm run build:web` (gera `dist/`, publicado na Vercel)
- Android: EAS Build

Decisões de stack e especificações em [docs/](docs/). Regras do projeto em [CLAUDE.md](CLAUDE.md).
