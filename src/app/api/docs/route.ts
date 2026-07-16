import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const HTML = `<!doctype html>
<html>
  <head>
    <title>AgentFlow API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html, body { margin: 0; padding: 0; height: 100%; }</style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '/api/openapi.json',
        theme: 'default',
      });
    </script>
  </body>
</html>`;

export async function GET() {
  return new NextResponse(HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
