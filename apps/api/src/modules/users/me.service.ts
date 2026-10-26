import type { Profile, ProfileUpdate } from "@dily/shared";
import type { PrismaClient, User } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import type { MediaService } from "../media/media.service.js";

export const toProfile = (user: User): Profile => ({
  id: user.id,
  phone: user.phoneE164,
  fullName: user.fullName,
  avatarPath: user.avatarPath,
  neighbourhood: user.neighbourhood,
  city: user.city,
});

export interface MeServiceDeps {
  prisma: PrismaClient;
  media: MediaService;
}

/** The signed-in user's own profile. */
export class MeService {
  constructor(private readonly deps: MeServiceDeps) {}

  async get(userId: string): Promise<Profile> {
    const user = await this.deps.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError(401, "unauthorized", "Invalid session.");
    return toProfile(user);
  }

  async update(userId: string, body: ProfileUpdate): Promise<Profile> {
    const user = await this.deps.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: body.fullName,
        // Undefined leaves the neighbourhood as it is
        ...(body.neighbourhood !== undefined
          ? { neighbourhood: body.neighbourhood }
          : {}),
      },
    });
    return toProfile(user);
  }

  /** Stores a new avatar, then deletes the previous one. */
  async setAvatar(userId: string, image: Buffer): Promise<Profile> {
    const path = await this.deps.media.store("avatars", userId, image);
    const previous = await this.deps.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    const user = await this.deps.prisma.user.update({
      where: { id: userId },
      data: { avatarPath: path },
    });
    if (previous?.avatarPath)
      await this.deps.media.remove([previous.avatarPath]);
    return toProfile(user);
  }

  /**
   * Deletes the account for good (App Store guideline 5.1.1(v)). The
   * database cascades to sessions, listings, likes (other listings' counts
   * follow through the trigger) and conversations; then every uploaded
   * image goes. Signing in again with the same number starts a new account.
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.deps.prisma.user.delete({ where: { id: userId } });
    await this.deps.media.removeAllOf(userId);
  }
}
