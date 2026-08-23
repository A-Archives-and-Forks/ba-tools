import { RecruitmentSessionEditor } from "@/app/user/recruitment/recruitment-session-editor";

export default async function NewRecruitmentSessionPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  return <RecruitmentSessionEditor accountId={accountId} />;
}
