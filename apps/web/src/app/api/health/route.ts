export async function GET() {
  return Response.json({ ok: true, kind: 'liveness', service: 'shopb', timestamp: new Date().toISOString() });
}
