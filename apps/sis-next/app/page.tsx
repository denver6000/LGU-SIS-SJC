import { AppShell } from "./app-shell";
import { AuthGuard } from "./auth-guard";

export default function HomePage() {
  return (
    <AuthGuard>
      <AppShell />
    </AuthGuard>
  );
}
