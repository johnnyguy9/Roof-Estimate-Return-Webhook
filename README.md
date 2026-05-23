# Roof Estimate Return Webhook

A Vercel-hosted webhook endpoint that receives roof-estimate callbacks and
returns formatted responses. Serverless functions live under `api/`, and a
thin static HTML surface lives under `public/`.

> **Status:** internal integration. Not a general-purpose library.

## Layout

| Path | Purpose |
| --- | --- |
| `api/` | Vercel serverless function handlers (TypeScript) |
| `public/` | Static assets served at the root |
| `vercel.json` | Routing and build config for Vercel |
| `tsconfig.json` | TypeScript compiler options |
| `package.json` | Dependencies |

## Quickstart

```bash
# 1. Install
npm ci

# 2. Configure environment
cp .env.example .env   # if .env.example exists
# Add your real keys to .env — do NOT commit it.

# 3. Local dev with the Vercel CLI
npx vercel dev
```

## Deploying

```bash
npx vercel --prod
```

Routes and rewrites are defined in `vercel.json`.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

MIT. See [`LICENSE`](./LICENSE).
