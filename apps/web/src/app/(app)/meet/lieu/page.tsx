import { PlaceScreen } from '../../../../features/dating/screens/date-screens';

export default async function MeetPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <PlaceScreen dateId={id ?? null} />;
}
