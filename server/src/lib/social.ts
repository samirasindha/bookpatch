import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { follows, notifications, type User } from "../db/schema.js";

export type Relationship = { isSelf: boolean; following: boolean; followedBy: boolean; friends: boolean };

/** How the viewer relates to another user. Friends = following each other. */
export async function relationship(viewerId: string, otherId: string): Promise<Relationship> {
  if (viewerId === otherId) return { isSelf: true, following: false, followedBy: false, friends: false };
  const [out, inc] = await Promise.all([
    db.query.follows.findFirst({ where: and(eq(follows.followerId, viewerId), eq(follows.followingId, otherId)) }),
    db.query.follows.findFirst({ where: and(eq(follows.followerId, otherId), eq(follows.followingId, viewerId)) }),
  ]);
  return { isSelf: false, following: !!out, followedBy: !!inc, friends: !!out && !!inc };
}

/** Whether the viewer may see this user's library, goal and reviews. */
export function canSeeLibrary(owner: Pick<User, "libraryVisibility">, rel: Relationship) {
  if (rel.isSelf) return true;
  if (owner.libraryVisibility === "public") return true;
  if (owner.libraryVisibility === "friends") return rel.friends;
  return false;
}

export type NotificationType = "new_follower" | "loan_created" | "loan_returned" | "nudge";

export async function notify(userId: string, type: NotificationType, payload: Record<string, unknown>) {
  await db.insert(notifications).values({ userId, type, payload: JSON.stringify(payload) });
}
