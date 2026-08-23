import { RecruitmentSessionEditor } from "@/app/user/recruitment/recruitment-session-editor";

export default async function RecruitmentSessionPage({
  params,
}: {
  params: Promise<{ accountId: string; sessionId: string }>;
}) {
  const { accountId, sessionId } = await params;
  return (
    <RecruitmentSessionEditor accountId={accountId} sessionId={sessionId} />
  );
}
