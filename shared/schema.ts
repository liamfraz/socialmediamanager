import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  subscriptionStatus: text("subscription_status").default("free"),
  planTier: text("plan_tier").default("free"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEndsAt: timestamp("current_period_ends_at"),
});

export const stripeEvents = pgTable("stripe_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull().unique(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Post status enum values
export const postStatusValues = ["pending", "approved", "rejected", "draft", "publishing", "posted", "failed"] as const;
export type PostStatus = typeof postStatusValues[number];
export const postStatusEnum = z.enum(postStatusValues);

// Post layout enum values (how photos are displayed)
export const postLayoutValues = ["single", "duo", "quadrant"] as const;
export type PostLayout = typeof postLayoutValues[number];
export const postLayoutEnum = z.enum(postLayoutValues);

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  images: text("images").array(),
  collaborators: text("collaborators").array(),
  order: integer("order").notNull(),
  layout: text("layout").notNull().default("single"),
  dateManuallySet: boolean("date_manually_set").notNull().default(false),
  publishError: text("publish_error"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Helper to convert string dates to Date objects
const dateTransform = z.preprocess(
  (val) => (typeof val === "string" ? new Date(val) : val),
  z.date()
);

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
}).extend({
  status: postStatusEnum,
  scheduledDate: dateTransform,
  order: z.number().int().optional(),
  layout: postLayoutEnum.optional(),
});

export const updatePostSchema = createInsertSchema(posts).omit({
  id: true,
}).extend({
  status: postStatusEnum.optional(),
  scheduledDate: dateTransform.optional(),
  layout: postLayoutEnum.optional(),
}).partial();

// Schema for reorder endpoint validation
export const reorderUpdateSchema = z.object({
  id: z.string(),
  order: z.number().int(),
});

export const reorderSchema = z.object({
  updates: z.array(reorderUpdateSchema),
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

// Photo Folders table for organizing uploads
export const photoFolders = pgTable("photo_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPhotoFolderSchema = createInsertSchema(photoFolders).omit({
  id: true,
});

export type InsertPhotoFolder = z.infer<typeof insertPhotoFolderSchema>;
export type PhotoFolder = typeof photoFolders.$inferSelect;

// Tagged photo status values
export const taggedPhotoStatusValues = ["available", "posted"] as const;
export type TaggedPhotoStatus = typeof taggedPhotoStatusValues[number];
export const taggedPhotoStatusEnum = z.enum(taggedPhotoStatusValues);

// Tagged Photos table
export const taggedPhotos = pgTable("tagged_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  folderId: varchar("folder_id").references(() => photoFolders.id),
  photoId: text("photo_id").notNull(),
  photoUrl: text("photo_url").notNull(),
  description: text("description"),
  tags: text("tags").array(),
  status: text("status").notNull().default("available"),
  postedAt: timestamp("posted_at"),
  // New fields for local file uploads
  originalFilename: text("original_filename"),
  storagePath: text("storage_path"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertTaggedPhotoSchema = createInsertSchema(taggedPhotos).omit({
  id: true,
});

export const updateTaggedPhotoSchema = createInsertSchema(taggedPhotos).omit({
  id: true,
}).partial();

export type InsertTaggedPhoto = z.infer<typeof insertTaggedPhotoSchema>;
export type UpdateTaggedPhoto = z.infer<typeof updateTaggedPhotoSchema>;
export type TaggedPhoto = typeof taggedPhotos.$inferSelect;

// Photo Batch tables for similarity detection
export const batchStatusValues = ["uploading", "processing", "needs_review", "complete"] as const;
export type BatchStatus = typeof batchStatusValues[number];

export const photoBatches = pgTable("photo_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  folderId: varchar("folder_id").references(() => photoFolders.id),
  status: text("status").notNull().default("uploading"),
  strictness: text("strictness").notNull().default("medium"),
  totalPhotos: integer("total_photos").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type PhotoBatch = typeof photoBatches.$inferSelect;

export const batchItemStatusValues = ["pending", "kept", "discarded"] as const;

export const photoBatchItems = pgTable("photo_batch_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").references(() => photoBatches.id).notNull(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  storagePath: text("storage_path").notNull(),
  photoUrl: text("photo_url").notNull(),
  hash: text("hash"),
  tags: text("tags").array(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type PhotoBatchItem = typeof photoBatchItems.$inferSelect;

export const similarGroups = pgTable("similar_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").references(() => photoBatches.id).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type SimilarGroup = typeof similarGroups.$inferSelect;

export const similarGroupItems = pgTable("similar_group_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").references(() => similarGroups.id).notNull(),
  batchItemId: varchar("batch_item_id").references(() => photoBatchItems.id).notNull(),
  distance: integer("distance").notNull().default(0),
  isSelected: boolean("is_selected").notNull().default(false),
});

export type SimilarGroupItem = typeof similarGroupItems.$inferSelect;

// Posting Settings table
export const postingSettings = pgTable("posting_settings", {
  id: varchar("id").primaryKey().default("default"),
  isPaused: text("is_paused").notNull().default("false"),
  webhookUrl: text("webhook_url"),
  defaultPostTime: text("default_post_time").notNull().default("17:00"),
});

export type PostingSettings = typeof postingSettings.$inferSelect;

// Instagram Credentials table (for multi-tenant OAuth)
export const instagramCredentials = pgTable("instagram_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  instagramUserId: text("instagram_user_id").notNull(),
  instagramUsername: text("instagram_username"),
  accessToken: text("access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  connectedAt: timestamp("connected_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export type InstagramCredentials = typeof instagramCredentials.$inferSelect;
export type InsertInstagramCredentials = typeof instagramCredentials.$inferInsert;
