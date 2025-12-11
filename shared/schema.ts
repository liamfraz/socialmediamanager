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

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  images: text("images").array(),
  order: integer("order").notNull(),
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
}).extend({
  status: postStatusEnum,
});

export const updatePostSchema = createInsertSchema(posts).omit({
  id: true,
}).extend({
  status: postStatusEnum.optional(),
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

// Tagged Photos table
export const taggedPhotos = pgTable("tagged_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: text("photo_id").notNull(),
  photoUrl: text("photo_url").notNull(),
  description: text("description"),
  tags: text("tags").array(),
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
