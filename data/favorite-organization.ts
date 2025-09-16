import { db } from "@/lib/db";

/**
 * Controlla se un utente segue già una certa organizzazione
 */
export async function isFollowingOrganization(userId: string, organizationId: string) {
  if (!userId || !organizationId) {
    return false;
  }

  const follow = await db.favoriteOrganization.findFirst({
    where: { userId, organizationId },
  });

  return follow ? true : false;
}