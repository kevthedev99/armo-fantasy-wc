import { AuthForm } from "@/components/AuthForm";
import { getPlayerCount } from "@/lib/player-count";

export default async function RegisterPage() {
  const playerCount = await getPlayerCount();
  return <AuthForm mode="register" playerCount={playerCount} />;
}
