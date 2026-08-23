import { RecruitmentAccountView } from "@/app/user/recruitment/recruitment-account-view";

export default async function RecruitmentAccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  return <RecruitmentAccountView accountId={accountId} />;
}
