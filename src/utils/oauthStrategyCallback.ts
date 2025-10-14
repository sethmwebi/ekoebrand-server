import { Request } from "express";
import { Profile as GoogleProfile } from "passport-google-oauth20";
import { Profile as FacebookProfile } from "passport-facebook";
import { Profile as TwitterProfile } from "passport-twitter";
/* import { VerifyCallback } from "passport-oauth2"; */
import createHttpError from "http-errors";
import { prisma } from "..";

type OAuthProfile = GoogleProfile | FacebookProfile | TwitterProfile;

interface OauthStrategyCallbackOptions {
  req: Request;
  accessToken: string;
  refreshToken: string;
  profile: OAuthProfile;
  provider: string;
  done: any;
}

export const oauthStrategyCallback = async ({
  req,
  accessToken,
  refreshToken,
  profile,
  provider,
  done,
}: OauthStrategyCallbackOptions): Promise<void> => {
  try {
    const email = profile.emails?.[0].value;
    if (!email) {
      return done(createHttpError(400, "No email found"), false);
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name:
            provider === "google"
              ? profile.displayName
              : `${profile.name?.givenName || ""} ${profile.name?.familyName || ""}`.trim(),
          image: profile.photos?.[0].value ?? null,
          password: null, // Explicitly set password to null
          emailVerified: new Date(),
        },
      });

      await prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider,
          providerAccountId: profile.id,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      });
    } else {
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId: profile.id,
          },
        },
      });

      if (!account) {
        await prisma.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider,
            providerAccountId: profile.id,
            access_token: accessToken,
            refresh_token: refreshToken,
          },
        });
      }
    }
    const { password, emailVerified, createdAt, updatedAt, ...userData } = user;
    return done(null, userData);
  } catch (error: any) {
    return done(error);
  }
};
