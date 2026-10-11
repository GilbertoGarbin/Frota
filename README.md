# Frota

SaaS de gestão de micro-frotas: **painel do gestor** (web) e **app do motorista** (Android) em um
único projeto Expo, com Supabase como backend.

- Decisões de stack e especificações: [docs/](docs/)
- Regras do projeto e organização do código: [CLAUDE.md](CLAUDE.md)

## Rodando no computador

```bash
npm install
cp .env.example .env.local   # URL e chave publishable do Supabase
npm run web                  # abre em http://localhost:8081
```

No navegador dá para usar os dois lados: o painel do gestor (e-mail e senha) e o app do motorista
("Sou motorista — ativar este aparelho", com CPF + código gerado no painel).

## Verificações

```bash
npx tsc --noEmit     # tipos
npm run lint         # ESLint
npm run test:db      # migrations, RLS e regras do banco num Postgres embutido (PGlite)
```

## Banco de dados (Supabase)

```bash
npx supabase db push                     # aplica as migrations novas de supabase/migrations/
npx supabase config push                 # aplica supabase/config.toml (Auth)
npx supabase gen types typescript --linked --schema public > src/db/database.types.ts
```

## Publicação

| O quê | Como |
|---|---|
| Painel web | Vercel, deploy automático a cada push na `main` (`vercel.json`: `npx expo export -p web` → `dist/`) |
| APK de teste | `eas build -p android --profile preview` (baixa o APK pelo link que o EAS mostra) |
| Correção sem reinstalar | `eas update --channel preview --message "..."` (só mudanças de JavaScript) |
| Play Store | `eas build -p android --profile production` (gera o `.aab`) |
| Backup do banco | GitHub Actions, toda semana (`.github/workflows/backup.yml`; precisa do segredo `SUPABASE_DB_URL`) |

Mudou algum módulo nativo (câmera, SQLite, permissões em `app.json`)? Precisa de um APK novo;
`eas update` não basta.
