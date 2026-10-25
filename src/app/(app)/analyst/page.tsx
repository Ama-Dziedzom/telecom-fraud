import { redirect } from "next/navigation";

/** Old signed-in landing; My queue is the Fraud Analyst home. */
export default function AnalystRedirect() {
  redirect("/queue");
}
