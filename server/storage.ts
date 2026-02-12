import { users, posts, taggedPhotos, postingSettings, instagramCredentials, photoFolders, photoBatches, photoBatchItems, similarGroups, similarGroupItems, type User, type InsertUser, type Post, type InsertPost, type TaggedPhoto, type InsertTaggedPhoto, type PostingSettings, type InstagramCredentials, type InsertInstagramCredentials, type PhotoFolder, type InsertPhotoFolder, type PhotoBatch, type PhotoBatchItem, type SimilarGroup, type SimilarGroupItem } from "@shared/schema";
import { db } from "./db";
import { eq, asc, and, max, desc, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined>;
  
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
  getAvailableTaggedPhotos(): Promise<TaggedPhoto[]>;
  getPostedTaggedPhotos(): Promise<TaggedPhoto[]>;
  getUnassignedTaggedPhotos(): Promise<TaggedPhoto[]>;
  getTaggedPhoto(id: string): Promise<TaggedPhoto | undefined>;
  createTaggedPhoto(photo: InsertTaggedPhoto, userId?: string): Promise<TaggedPhoto>;
  updateTaggedPhoto(id: string, data: Partial<InsertTaggedPhoto>): Promise<TaggedPhoto | undefined>;
  deleteTaggedPhoto(id: string): Promise<boolean>;
  deleteTaggedPhotosByUrls(photoUrls: string[]): Promise<number>;
  claimTaggedPhotos(photoIds: string[], userId: string): Promise<number>;
  markPhotosAsPosted(photoUrls: string[]): Promise<number>;

  // Posting Settings operations
  getPostingSettings(): Promise<PostingSettings>;
  updatePostingSettings(data: Partial<PostingSettings>): Promise<PostingSettings>;
  
  // Posts by status with scheduled date filtering
  getDuePosts(): Promise<Post[]>;

  // Instagram Credentials operations
  getInstagramCredentials(userId: string): Promise<InstagramCredentials | undefined>;
  saveInstagramCredentials(credentials: InsertInstagramCredentials): Promise<InstagramCredentials>;
  deleteInstagramCredentials(userId: string): Promise<boolean>;

  // Photo Folder operations
  getAllPhotoFolders(userId?: string): Promise<PhotoFolder[]>;
  getPhotoFolder(id: string): Promise<PhotoFolder | undefined>;
  createPhotoFolder(folder: InsertPhotoFolder): Promise<PhotoFolder>;
  updatePhotoFolder(id: string, data: Partial<InsertPhotoFolder>): Promise<PhotoFolder | undefined>;
  deletePhotoFolder(id: string): Promise<boolean>;
  getPhotosInFolder(folderId: string): Promise<TaggedPhoto[]>;
  getPhotosWithoutFolder(): Promise<TaggedPhoto[]>;

  // Photo Batch operations for similarity detection
  createPhotoBatch(data: { userId: string; folderId?: string | null; strictness?: string; totalPhotos: number }): Promise<PhotoBatch>;
  getPhotoBatch(id: string): Promise<PhotoBatch | undefined>;
  updatePhotoBatchStatus(id: string, status: string): Promise<PhotoBatch | undefined>;
  createBatchItem(data: { batchId: string; filename: string; originalFilename: string; storagePath: string; photoUrl: string; hash?: string | null; tags?: string[] | null }): Promise<PhotoBatchItem>;
  getBatchItems(batchId: string): Promise<PhotoBatchItem[]>;
  updateBatchItemHash(id: string, hash: string): Promise<void>;
  updateBatchItemStatus(id: string, status: string): Promise<void>;
  createSimilarGroup(batchId: string): Promise<SimilarGroup>;
  createSimilarGroupItem(data: { groupId: string; batchItemId: string; distance: number }): Promise<SimilarGroupItem>;
  getSimilarGroups(batchId: string): Promise<(SimilarGroup & { items: (SimilarGroupItem & { batchItem: PhotoBatchItem })[] })[]>;
  updateSimilarGroupItemSelection(groupId: string, batchItemId: string, isSelected: boolean): Promise<void>;
  deleteBatchData(batchId: string): Promise<void>;
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

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id)).returning();
    return user || undefined;
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

  // Tagged Photos operations - scoped by user
  async getAllTaggedPhotos(userId?: string): Promise<TaggedPhoto[]> {
    if (userId) {
      return db.select().from(taggedPhotos).where(eq(taggedPhotos.userId, userId));
    }
    // Return all if no userId (for migrations/admin)
    return db.select().from(taggedPhotos);
  }

  async getAvailableTaggedPhotos(): Promise<TaggedPhoto[]> {
    return db.select().from(taggedPhotos).where(eq(taggedPhotos.status, "available"));
  }

  async getPostedTaggedPhotos(): Promise<TaggedPhoto[]> {
    return db.select().from(taggedPhotos).where(eq(taggedPhotos.status, "posted")).orderBy(desc(taggedPhotos.postedAt));
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

  async deleteTaggedPhotosByUrls(photoUrls: string[]): Promise<number> {
    if (photoUrls.length === 0) return 0;
    const { inArray, or } = await import("drizzle-orm");
    // Match on either photoUrl or photoId to handle both URL and ID formats
    const result = await db
      .delete(taggedPhotos)
      .where(
        or(
          inArray(taggedPhotos.photoUrl, photoUrls),
          inArray(taggedPhotos.photoId, photoUrls)
        )
      )
      .returning();
    return result.length;
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

  async markPhotosAsPosted(photoUrls: string[]): Promise<number> {
    if (photoUrls.length === 0) return 0;
    const { inArray, or } = await import("drizzle-orm");
    // Match on either photoUrl or photoId to handle both URL and ID formats
    const result = await db
      .update(taggedPhotos)
      .set({ status: "posted", postedAt: new Date() })
      .where(
        or(
          inArray(taggedPhotos.photoUrl, photoUrls),
          inArray(taggedPhotos.photoId, photoUrls)
        )
      )
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

  // Instagram Credentials operations
  async getInstagramCredentials(userId: string): Promise<InstagramCredentials | undefined> {
    const [credentials] = await db.select().from(instagramCredentials).where(eq(instagramCredentials.userId, userId));
    return credentials || undefined;
  }

  async saveInstagramCredentials(credentials: InsertInstagramCredentials): Promise<InstagramCredentials> {
    // Delete existing credentials for this user first (one account per user)
    await db.delete(instagramCredentials).where(eq(instagramCredentials.userId, credentials.userId));

    // Insert new credentials
    const [saved] = await db.insert(instagramCredentials).values(credentials).returning();
    return saved;
  }

  async deleteInstagramCredentials(userId: string): Promise<boolean> {
    const result = await db.delete(instagramCredentials).where(eq(instagramCredentials.userId, userId)).returning();
    return result.length > 0;
  }

  // Photo Folder operations
  async getAllPhotoFolders(userId?: string): Promise<PhotoFolder[]> {
    if (userId) {
      return db.select().from(photoFolders).where(eq(photoFolders.userId, userId)).orderBy(desc(photoFolders.createdAt));
    }
    return db.select().from(photoFolders).orderBy(desc(photoFolders.createdAt));
  }

  async getPhotoFolder(id: string): Promise<PhotoFolder | undefined> {
    const [folder] = await db.select().from(photoFolders).where(eq(photoFolders.id, id));
    return folder || undefined;
  }

  async createPhotoFolder(insertFolder: InsertPhotoFolder): Promise<PhotoFolder> {
    const [folder] = await db.insert(photoFolders).values(insertFolder).returning();
    return folder;
  }

  async updatePhotoFolder(id: string, data: Partial<InsertPhotoFolder>): Promise<PhotoFolder | undefined> {
    const [folder] = await db.update(photoFolders).set(data).where(eq(photoFolders.id, id)).returning();
    return folder || undefined;
  }

  async deletePhotoFolder(id: string): Promise<boolean> {
    // First, delete all photos in this folder
    await db.delete(taggedPhotos).where(eq(taggedPhotos.folderId, id));
    // Then delete the folder
    const result = await db.delete(photoFolders).where(eq(photoFolders.id, id)).returning();
    return result.length > 0;
  }

  async getPhotosInFolder(folderId: string): Promise<TaggedPhoto[]> {
    return db.select().from(taggedPhotos).where(eq(taggedPhotos.folderId, folderId)).orderBy(desc(taggedPhotos.createdAt));
  }

  async getPhotosWithoutFolder(): Promise<TaggedPhoto[]> {
    const { isNull } = await import("drizzle-orm");
    return db.select().from(taggedPhotos).where(isNull(taggedPhotos.folderId)).orderBy(desc(taggedPhotos.createdAt));
  }

  // Photo Batch operations
  async createPhotoBatch(data: { userId: string; folderId?: string | null; strictness?: string; totalPhotos: number }): Promise<PhotoBatch> {
    const [batch] = await db.insert(photoBatches).values({
      userId: data.userId,
      folderId: data.folderId || null,
      strictness: data.strictness || "medium",
      totalPhotos: data.totalPhotos,
      status: "uploading",
    }).returning();
    return batch;
  }

  async getPhotoBatch(id: string): Promise<PhotoBatch | undefined> {
    const [batch] = await db.select().from(photoBatches).where(eq(photoBatches.id, id));
    return batch || undefined;
  }

  async updatePhotoBatchStatus(id: string, status: string): Promise<PhotoBatch | undefined> {
    const [batch] = await db.update(photoBatches).set({ status }).where(eq(photoBatches.id, id)).returning();
    return batch || undefined;
  }

  async createBatchItem(data: { batchId: string; filename: string; originalFilename: string; storagePath: string; photoUrl: string; hash?: string | null; tags?: string[] | null }): Promise<PhotoBatchItem> {
    const [item] = await db.insert(photoBatchItems).values(data).returning();
    return item;
  }

  async getBatchItems(batchId: string): Promise<PhotoBatchItem[]> {
    return db.select().from(photoBatchItems).where(eq(photoBatchItems.batchId, batchId));
  }

  async updateBatchItemHash(id: string, hash: string): Promise<void> {
    await db.update(photoBatchItems).set({ hash }).where(eq(photoBatchItems.id, id));
  }

  async updateBatchItemStatus(id: string, status: string): Promise<void> {
    await db.update(photoBatchItems).set({ status }).where(eq(photoBatchItems.id, id));
  }

  async createSimilarGroup(batchId: string): Promise<SimilarGroup> {
    const [group] = await db.insert(similarGroups).values({ batchId }).returning();
    return group;
  }

  async createSimilarGroupItem(data: { groupId: string; batchItemId: string; distance: number }): Promise<SimilarGroupItem> {
    const [item] = await db.insert(similarGroupItems).values(data).returning();
    return item;
  }

  async getSimilarGroups(batchId: string): Promise<(SimilarGroup & { items: (SimilarGroupItem & { batchItem: PhotoBatchItem })[] })[]> {
    const groups = await db.select().from(similarGroups).where(eq(similarGroups.batchId, batchId));
    
    const result = [];
    for (const group of groups) {
      const items = await db
        .select()
        .from(similarGroupItems)
        .innerJoin(photoBatchItems, eq(similarGroupItems.batchItemId, photoBatchItems.id))
        .where(eq(similarGroupItems.groupId, group.id));
      
      result.push({
        ...group,
        items: items.map(row => ({
          ...row.similar_group_items,
          batchItem: row.photo_batch_items,
        })),
      });
    }
    return result;
  }

  async updateSimilarGroupItemSelection(groupId: string, batchItemId: string, isSelected: boolean): Promise<void> {
    await db
      .update(similarGroupItems)
      .set({ isSelected })
      .where(and(eq(similarGroupItems.groupId, groupId), eq(similarGroupItems.batchItemId, batchItemId)));
  }

  async deleteBatchData(batchId: string): Promise<void> {
    const groups = await db.select().from(similarGroups).where(eq(similarGroups.batchId, batchId));
    for (const group of groups) {
      await db.delete(similarGroupItems).where(eq(similarGroupItems.groupId, group.id));
    }
    await db.delete(similarGroups).where(eq(similarGroups.batchId, batchId));
    await db.delete(photoBatchItems).where(eq(photoBatchItems.batchId, batchId));
    await db.delete(photoBatches).where(eq(photoBatches.id, batchId));
  }
}

export const storage = new DatabaseStorage();
