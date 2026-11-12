import { PaymentReceiptScreen } from '../../../../../features/dating/screens/date-screens';

export default async function MeetPayReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <PaymentReceiptScreen dateId={id ?? null} />;
}
