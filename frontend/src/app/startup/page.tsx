import { redirect } from "next/navigation";

export default function StartupIndexRedirect() {
  redirect("/startup/dashboard");
}
