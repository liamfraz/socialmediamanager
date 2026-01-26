import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Post status enum values
export const postStatusValues = ["pending", "approved", "rejected", "draft", "posted"] as const;
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
