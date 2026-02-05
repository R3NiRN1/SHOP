export async function GET() {
  return Response.json({ ok: true, service: 'shopb', timestamp: new Date().toISOString() });
}
