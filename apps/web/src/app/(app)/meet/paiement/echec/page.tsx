import { PaymentFailureScreen } from '../../../../../features/dating/screens/date-screens';

export default async function MeetPayFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <PaymentFailureScreen dateId={id ?? null} />;
}
