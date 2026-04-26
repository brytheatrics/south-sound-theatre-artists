// Single-use token helpers for magic links + email verification.
//
// We hand the artist an opaque base64url string in their email and store
// only its SHA-256 hash in the database. Even a full DB dump can't be
// turned into a usable token without the original URL.

import { createHash, randomBytes } from "node:crypto";

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
