import { AuthForm } from "@/components/AuthForm";
import { getPlayerCount } from "@/lib/player-count";

export default async function LoginPage() {
  const playerCount = await getPlayerCount();
  return <AuthForm mode="login" playerCount={playerCount} />;
}
