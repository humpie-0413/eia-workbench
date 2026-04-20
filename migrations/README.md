# D1 migrations

Local:
```bash
npm run db:migrate:local
```

Production (first time):
```bash
npx wrangler d1 create eia-workbench
# copy database_id into wrangler.toml
npx wrangler d1 migrations apply DB --remote
```
