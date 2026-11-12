import { PaymentPendingScreen } from '../../../../../features/dating/screens/date-screens';

export default async function MeetPayPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <PaymentPendingScreen dateId={id ?? null} />;
}
