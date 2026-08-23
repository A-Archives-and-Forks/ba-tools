import { RecruitmentAnalyticsPage } from "@/app/user/recruitment/recruitment-analytics-page";

export default async function RecruitmentAnalyticsRoute({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  return <RecruitmentAnalyticsPage accountId={accountId} />;
}
