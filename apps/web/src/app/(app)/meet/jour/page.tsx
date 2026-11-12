import { DayScreen } from '../../../../features/dating/screens/date-screens';

export default async function MeetDayPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <DayScreen dateId={id ?? null} />;
}
