import { MatchScreen } from '../../../../features/dating/screens/date-screens';

export default async function MeetMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <MatchScreen dateId={id ?? null} />;
}
