import { OrderReceipt } from './receipt';
export const dynamic = 'force-dynamic';
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) { return <OrderReceipt id={(await params).id} />; }
