import { Banner } from "@/components/ui/Banner";
import { ApiError, OfflineError } from "@/lib/api/client";

/**
 * Turns an error a screen didn’t handle itself into a banner, so a failed
 * request never leaves a spinner running. Uses the API’s own wording.
 */
export function RequestError({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof OfflineError) {
    return (
      <Banner tone="warning" title="You’re offline">
        Check your network or VPN, then try again. What you typed is kept.
      </Banner>
    );
  }
  if (error instanceof ApiError) {
    return (
      <Banner tone="error" title={error.problem.title ?? "Something went wrong"}>
        {error.problem.detail ?? "Please try again."}
        {error.problem.request_id ? ` Reference ${error.problem.request_id}.` : ""}
      </Banner>
    );
  }
  return (
    <Banner tone="error" title="Something went wrong">
      Please try again.
    </Banner>
  );
}
