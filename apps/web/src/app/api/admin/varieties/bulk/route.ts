import { adminAccess, api, json, readJson } from '../../../../../lib/commerce-http';
import { CommerceError, record } from '../../../../../lib/commerce-input';
import { getPrisma } from '../../../../../lib/prisma';
export async function POST(request: Request) {
  return api(async () => {
    const auth = await adminAccess(request); if (!auth.ok) return auth.response;
    const data = record(await readJson(request));
    if (!Array.isArray(data.ids) || !data.ids.length || data.ids.length > 50 || data.ids.some((id) => typeof id !== 'string' || id.length > 100)) throw new CommerceError('Select up to 50 varieties.');
    if (data.action !== 'publish' && data.action !== 'unpublish') throw new CommerceError('Choose publish or unpublish.');
    return json(await getPrisma().variety.updateMany({ where: { id: { in: data.ids }, archived: false }, data: { published: data.action === 'publish' } }));
  });
}
