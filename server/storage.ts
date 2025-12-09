import { users, posts, type User, type InsertUser, type Post, type InsertPost } from "@shared/schema";
import { db } from "./db";
import { eq, asc, and, max } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Post operations
  getAllPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, data: Partial<InsertPost>): Promise<Post | undefined>;
  updatePostStatus(id: string, status: string): Promise<Post | undefined>;
  reorderPosts(updates: { id: string; order: number }[]): Promise<void>;
  deletePost(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllPosts(): Promise<Post[]> {
    return db.select().from(posts).orderBy(asc(posts.order));
  }

  async getPost(id: string): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post || undefined;
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(insertPost).returning();
    return post;
  }

  async updatePost(id: string, data: Partial<InsertPost>): Promise<Post | undefined> {
    const [post] = await db.update(posts).set(data).where(eq(posts.id, id)).returning();
    return post || undefined;
  }

  async updatePostStatus(id: string, status: string): Promise<Post | undefined> {
    // When approving a post, set its order to be at the bottom of approved posts
    if (status === "approved") {
      const [result] = await db
        .select({ maxOrder: max(posts.order) })
        .from(posts)
        .where(eq(posts.status, "approved"));
      
      const newOrder = (result?.maxOrder ?? 0) + 1;
      const [post] = await db
        .update(posts)
        .set({ status, order: newOrder })
        .where(eq(posts.id, id))
        .returning();
      return post || undefined;
    }
    
    const [post] = await db.update(posts).set({ status }).where(eq(posts.id, id)).returning();
    return post || undefined;
  }

  async reorderPosts(updates: { id: string; order: number }[]): Promise<void> {
    for (const update of updates) {
      await db.update(posts).set({ order: update.order }).where(eq(posts.id, update.id));
    }
  }

  async deletePost(id: string): Promise<boolean> {
    const result = await db.delete(posts).where(eq(posts.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
