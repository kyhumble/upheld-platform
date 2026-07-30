import { redirect } from "next/navigation";

/** Visible signup entry — reuses sign-in page with signup emphasized. */
export default function SignUpPage() {
  redirect("/sign-in?mode=signup");
}
