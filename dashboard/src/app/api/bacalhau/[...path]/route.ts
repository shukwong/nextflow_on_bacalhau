import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy to a Bacalhau REST endpoint.
 *
 * Forwards /api/bacalhau/<path> → ${BACALHAU_API_URL}/<path> and preserves the
 * query string. Avoids CORS entirely (the client only talks to Next.js) and
 * gives us a single place to add auth / logging later.
 */

const DEFAULT_API = 'http://localhost:1234';

function targetFor(pathSegs: string[], search: string): string {
  const base = process.env.BACALHAU_API_URL ?? DEFAULT_API;
  const path = pathSegs.map(encodeURIComponent).join('/');
  const qs = search ?? '';
  return `${base.replace(/\/$/, '')}/${path}${qs}`;
}

async function forward(
  request: NextRequest,
  ctx: { params: { path: string[] } },
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
): Promise<NextResponse> {
  const url = new URL(request.url);
  const target = targetFor(ctx.params.path ?? [], url.search);

  const init: RequestInit = {
    method,
    headers: { accept: 'application/json' },
    cache: 'no-store',
  };

  if (method !== 'GET' && method !== 'DELETE') {
    init.body = await request.text();
    (init.headers as Record<string, string>)['content-type'] =
      request.headers.get('content-type') ?? 'application/json';
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'bacalhau_proxy_unreachable',
        target,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return forward(request, ctx, 'GET');
}

export async function POST(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return forward(request, ctx, 'POST');
}

export async function PUT(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return forward(request, ctx, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return forward(request, ctx, 'DELETE');
}
