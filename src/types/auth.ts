// src/types/auth.ts

export interface SerializedUser {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  username?: string | null;
  mobileNumber?: string | null;
  isVerified?: boolean;
}

// Correct callback types for Passport
export type SerializeDoneCallback = (err: any, id?: unknown) => void;
export type DeserializeDoneCallback = (
  err: any,
  user?: Express.User | false | null,
) => void;
export type VerifyDoneCallback = (
  err: any,
  user?: Express.User | false,
  info?: any,
) => void;

// Extend Express User type
declare global {
  namespace Express {
    interface User extends SerializedUser {}
  }
}
