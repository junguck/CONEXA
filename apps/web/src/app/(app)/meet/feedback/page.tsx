import { FeedbackScreen } from '../../../../features/dating/screens/date-screens';

export default async function MeetFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <FeedbackScreen dateId={id ?? null} />;
}
