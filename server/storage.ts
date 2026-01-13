import { users, posts, taggedPhotos, postingSettings, type User, type InsertUser, type Post, type InsertPost, type TaggedPhoto, type InsertTaggedPhoto, type PostingSettings } from "@shared/schema";
import { db } from "./db";
import { eq, asc, and, max, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Post operations - userId scoped
  getAllPosts(userId?: string): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, data: Partial<InsertPost>): Promise<Post | undefined>;
  updatePostStatus(id: string, status: string, userId?: string): Promise<Post | undefined>;
  reorderPosts(updates: { id: string; order: number }[]): Promise<void>;
  deletePost(id: string): Promise<boolean>;

  // Tagged Photos operations - shared library (single user mode)
  getAllTaggedPhotos(): Promise<TaggedPhoto[]>;
  getUnassignedTaggedPhotos(): Promise<TaggedPhoto[]>;
  getTaggedPhoto(id: string): Promise<TaggedPhoto | undefined>;
  createTaggedPhoto(photo: InsertTaggedPhoto, userId?: string): Promise<TaggedPhoto>;
  updateTaggedPhoto(id: string, data: Partial<InsertTaggedPhoto>): Promise<TaggedPhoto | undefined>;
  deleteTaggedPhoto(id: string): Promise<boolean>;
  claimTaggedPhotos(photoIds: string[], userId: string): Promise<number>;

  // Posting Settings operations
  getPostingSettings(): Promise<PostingSettings>;
  updatePostingSettings(data: Partial<PostingSettings>): Promise<PostingSettings>;
  
  // Posts by status with scheduled date filtering
  getDuePosts(): Promise<Post[]>;
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

  async getAllPosts(userId?: string): Promise<Post[]> {
    if (userId) {
      return db.select().from(posts).where(eq(posts.userId, userId)).orderBy(asc(posts.order));
    }
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

  async updatePostStatus(id: string, status: string, userId?: string): Promise<Post | undefined> {
    // When approving a post, set its order to be at the bottom of approved posts
    if (status === "approved") {
      const [result] = await db
        .select({ maxOrder: max(posts.order) })
        .from(posts)
        .where(userId ? and(eq(posts.status, "approved"), eq(posts.userId, userId)) : eq(posts.status, "approved"));
      
      const newOrder = (result?.maxOrder ?? 0) + 1;
      const [post] = await db
        .update(posts)
        .set({ status, order: newOrder })
        .where(userId ? and(eq(posts.id, id), eq(posts.userId, userId)) : eq(posts.id, id))
        .returning();
      return post || undefined;
    }
    
    const [post] = await db.update(posts).set({ status }).where(userId ? and(eq(posts.id, id), eq(posts.userId, userId)) : eq(posts.id, id)).returning();
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

  // Tagged Photos operations - shared library (single user mode)
  async getAllTaggedPhotos(): Promise<TaggedPhoto[]> {
    // Single user mode: return ALL photos
    return db.select().from(taggedPhotos);
  }

  async getTaggedPhoto(id: string): Promise<TaggedPhoto | undefined> {
    const [photo] = await db.select().from(taggedPhotos).where(eq(taggedPhotos.id, id));
    return photo || undefined;
  }

  async createTaggedPhoto(insertPhoto: InsertTaggedPhoto, userId?: string): Promise<TaggedPhoto> {
    const photoWithUser = userId ? { ...insertPhoto, userId } : insertPhoto;
    const [photo] = await db.insert(taggedPhotos).values(photoWithUser).returning();
    return photo;
  }

  async updateTaggedPhoto(id: string, data: Partial<InsertTaggedPhoto>): Promise<TaggedPhoto | undefined> {
    const [photo] = await db.update(taggedPhotos).set(data).where(eq(taggedPhotos.id, id)).returning();
    return photo || undefined;
  }

  async deleteTaggedPhoto(id: string): Promise<boolean> {
    const result = await db.delete(taggedPhotos).where(eq(taggedPhotos.id, id)).returning();
    return result.length > 0;
  }

  async getUnassignedTaggedPhotos(): Promise<TaggedPhoto[]> {
    const { isNull } = await import("drizzle-orm");
    return db.select().from(taggedPhotos).where(isNull(taggedPhotos.userId));
  }

  async claimTaggedPhotos(photoIds: string[], userId: string): Promise<number> {
    const { isNull, inArray } = await import("drizzle-orm");
    const result = await db
      .update(taggedPhotos)
      .set({ userId })
      .where(and(inArray(taggedPhotos.id, photoIds), isNull(taggedPhotos.userId)))
      .returning();
    return result.length;
  }

  // Posting Settings operations
  async getPostingSettings(): Promise<PostingSettings> {
    const [settings] = await db.select().from(postingSettings).where(eq(postingSettings.id, "default"));
    if (!settings) {
      // Create default settings if not exists
      const [newSettings] = await db.insert(postingSettings).values({
        id: "default",
        isPaused: "false",
        webhookUrl: null,
        defaultPostTime: "17:00",
      }).returning();
      return newSettings;
    }
    return settings;
  }

  async updatePostingSettings(data: Partial<PostingSettings>): Promise<PostingSettings> {
    // Try to update existing
    const [updated] = await db
      .update(postingSettings)
      .set(data)
      .where(eq(postingSettings.id, "default"))
      .returning();
    
    if (updated) {
      return updated;
    }
    
    // If no existing settings, create with provided data
    const [newSettings] = await db.insert(postingSettings).values({
      id: "default",
      isPaused: data.isPaused || "false",
      webhookUrl: data.webhookUrl || null,
      defaultPostTime: data.defaultPostTime || "17:00",
    }).returning();
    return newSettings;
  }

  // Get approved posts that are due (scheduled time has passed)
  async getDuePosts(): Promise<Post[]> {
    const now = new Date();
    const allPosts = await db.select().from(posts)
      .where(eq(posts.status, "approved"))
      .orderBy(asc(posts.scheduledDate));
    
    return allPosts.filter(post => new Date(post.scheduledDate) <= now);
  }
}

export const storage = new DatabaseStorage();
