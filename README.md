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

## Desplegar en Vercel

Next.js se detecta solo. El repo ya incluye `vercel.json` y `.env.example`.

1. Sube el código a GitHub (`git push origin main`).
2. En [vercel.com/new](https://vercel.com/new) importa el repositorio `DiaGramG`.
3. Framework: **Next.js**. Build: `npm run build`. Output: el default.
4. Añade `AI_GATEWAY_API_KEY` (Production, Preview y Development) desde [Vercel AI Gateway](https://vercel.com/ai-gateway).
5. Deploy. La URL queda en `https://<proyecto>.vercel.app`.

En el dashboard de Vercel también puedes activar créditos de AI Gateway (o BYOK). La conversión puede tardar hasta 3 minutos (`maxDuration` 180 s). Las funciones de Vercel limitan el body a 4.5 MB: la app envía capturas JPEG, no el PDF original.
