# DiaGramG

Página web para subir el PDF de un diagrama y reconstruirlo como un diagrama HTML moderno e interactivo.

## Uso

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). **Ver ejemplo** funciona sin clave. Para convertir tus PDF:

1. Crea `.env.local` con `AI_GATEWAY_API_KEY` de [Vercel AI Gateway](https://vercel.com/ai-gateway)
2. Reinicia `npm run dev`
3. Suelta el PDF (o una imagen PNG/JPG del diagrama)

El resultado se puede explorar en el lienzo (zoom, detalle al clic, comparación con el original) y exportar como HTML autónomo.
