import { Request } from "express";
import passport from "passport";
import {
  Strategy as JWTStrategy,
  StrategyOptions,
  VerifiedCallback,
} from "passport-jwt";
import {
  Strategy as GoogleStrategy,
  Profile as GoogleProfile,
} from "passport-google-oauth20";
import {
  Strategy as FacebookStrategy,
  Profile as FacebookProfile,
} from "passport-facebook";
import {
  Strategy as TwitterStrategy,
  Profile as TwitterProfile,
} from "passport-twitter";
import { VerifyCallback } from "passport-oauth2";
import { prisma } from "..";
import validEnv from "./validEnv";
import { oauthStrategyCallback } from "./oauthStrategyCallback";
import { Role } from "../../generated/prisma_client";

const cookieExtractor = (req: Request): string | null => {
  let token: string | null = null;
  if (req && req.cookies) {
    token = req.cookies["refreshToken"];
  }
  return token;
};

interface JWTPayload {
  id: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

// JWT Strategy
const jwtOptions: StrategyOptions = {
  jwtFromRequest: cookieExtractor,
  secretOrKey: validEnv.ACCESS_TOKEN_SECRET,
  passReqToCallback: true,
};

passport.use(
  new JWTStrategy(
    jwtOptions,
    async (req: Request, jwtPayload: JWTPayload, done: VerifiedCallback) => {
      try {
        const user = await prisma.user.findUnique({
          where: {
            id: jwtPayload.id,
          },
        });

        if (user) {
          return done(null, user, req);
        } else {
          return done(null, false);
        }
      } catch (error) {
        return done(error, false);
      }
    },
  ),
);

passport.use(
  new GoogleStrategy(
    {
      clientID: validEnv.GOOGLE_CLIENT_ID,
      clientSecret: validEnv.GOOGLE_CLIENT_SECRET,
      callbackURL: validEnv.GOOGLE_CALLBACK,
      passReqToCallback: true,
    },
    (
      req: Request,
      accessToken: string,
      refreshToken: string,
      profile: GoogleProfile,
      done: VerifyCallback,
    ) => {
      oauthStrategyCallback({
        req,
        accessToken,
        refreshToken,
        profile,
        provider: "google",
        done,
      });
    },
  ),
);

passport.use(
  new FacebookStrategy(
    {
      clientID: validEnv.FACEBOOK_APP_ID,
      clientSecret: validEnv.FACEBOOK_APP_SECRET,
      callbackURL: validEnv.FACEBOOK_CALLBACK,
      profileFields: ["id", "emails", "name", "photos"],
      passReqToCallback: true,
    },
    (
      req: Request,
      accessToken: string,
      refreshToken: string,
      profile: FacebookProfile,
      done: VerifyCallback,
    ) => {
      oauthStrategyCallback({
        req,
        accessToken,
        refreshToken,
        profile,
        provider: "facebook",
        done,
      });
    },
  ),
);

passport.use(
  new TwitterStrategy(
    {
      consumerKey: validEnv.TWITTER_CLIENT_ID,
      consumerSecret: validEnv.TWITTER_CLIENT_SECRET,
      callbackURL: validEnv.TWITTER_CALLBACK,
      passReqToCallback: true,
      includeEmail: true,
    },
    (
      req: Request,
      token: string,
      tokenSecret: string,
      profile: TwitterProfile,
      done: VerifyCallback,
    ) => {
      oauthStrategyCallback({
        req,
        accessToken: token,
        refreshToken: tokenSecret,
        profile,
        provider: "twitter",
        done,
      });
    },
  ),
);

export default passport;
