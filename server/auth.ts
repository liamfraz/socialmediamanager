import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(username: string, password: string): Promise<User> {
  const hashedPassword = await hashPassword(password);
  return storage.createUser({ username, password: hashedPassword });
}

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  const user = await storage.getUserByUsername(username);
  if (!user) {
    return null;
  }
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }
  return user;
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    instagramOAuthState?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export async function getCurrentUser(req: Request): Promise<User | null> {
  if (!req.session?.userId) {
    return null;
  }
  return storage.getUser(req.session.userId) || null;
}
