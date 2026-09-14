const apiOrigin = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3201').replace(
  /\/$/,
  ''
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const response = await fetch(`${apiOrigin}/api/v1/works/imports/kwork-balance-report`, {
    method: 'POST',
    headers: {
      Authorization: request.headers.get('authorization') ?? ''
    },
    body: await request.formData()
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json'
    }
  });
}
