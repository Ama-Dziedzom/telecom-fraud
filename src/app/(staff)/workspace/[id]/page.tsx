import { WorkspacePlaceholder } from "@/components/auth/WorkspacePlaceholder";

export default async function WorkspacePage({ params }: PageProps<"/workspace/[id]">) {
  const { id } = await params;
  return <WorkspacePlaceholder name={id === "platform" ? "Platform console" : id} />;
}
