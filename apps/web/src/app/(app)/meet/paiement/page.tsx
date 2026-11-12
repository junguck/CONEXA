import { PaymentScreen } from '../../../../features/dating/screens/date-screens';

export default async function MeetPayPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <PaymentScreen dateId={id ?? null} />;
}
