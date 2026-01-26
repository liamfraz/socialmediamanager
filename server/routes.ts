import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPostSchema, updatePostSchema, postStatusEnum, reorderSchema, insertTaggedPhotoSchema, updateTaggedPhotoSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { hashPassword, verifyPassword, requireAuth, getCurrentUser } from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeImageForTags, isOpenAIConfigured, regenerateCaption } from "./openai";
import { generatePost, isPostGenerationAvailable, type PhotoForAI } from "./post-generator";
import {
  isInstagramConfigured,
  getInstagramAuthUrl,
  exchangeCodeForToken,
  postToInstagram,
} from "./instagram";

// Helper to get userId from session (throws if not authenticated)
function getUserId(req: Request): string {
  const userId = req.session.userId;
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

// Webhook URL from environment (with default for n8n posting workflow)
const POSTING_WEBHOOK_URL = process.env.N8N_POSTING_WEBHOOK_URL || "https://liamfraz3.app.n8n.cloud/webhook/BPosting";

// Configure multer for file uploads
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: uuid-originalname
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${uniqueId}-${safeName}`);
  },
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: jpg, jpeg, png, webp`));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth routes - Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already taken" });
      }
      
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({ username, password: hashedPassword });
      
      req.session.userId = user.id;
      res.status(201).json({ id: user.id, username: user.username });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Auth routes - Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = insertUserSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      req.session.userId = user.id;
      res.json({ id: user.id, username: user.username });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Auth routes - Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error logging out:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  // Auth routes - Get current user
  app.get("/api/auth/me", async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.json(null);
    }
    res.json({ id: user.id, username: user.username });
  });
  // Get all posts (scoped to current user)
  app.get("/api/posts", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const posts = await storage.getAllPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  // Helper function to recalculate scheduled dates for approved posts (user-scoped)
  async function recalculateApprovedPostsDates(userId?: string) {
    const allPosts = await storage.getAllPosts(userId);
    const approvedPosts = allPosts
      .filter(p => p.status === "approved")
      .sort((a, b) => a.order - b.order);
    
    // 5pm Melbourne time (AEDT = UTC+11) = 6am UTC
    const today = new Date();
    today.setUTCHours(6, 0, 0, 0); // 5pm Melbourne = 6am UTC
    
    // If today's 5pm Melbourne has passed, start from tomorrow
    if (new Date() >= today) {
      today.setUTCDate(today.getUTCDate() + 1);
    }
    
    for (let i = 0; i < approvedPosts.length; i++) {
      const scheduledDate = new Date(today);
      scheduledDate.setUTCDate(today.getUTCDate() + i);
      
      await storage.updatePost(approvedPosts[i].id, { scheduledDate });
    }
  }

  // Reorder posts - MUST be before /api/posts/:id to avoid matching "reorder" as an id
  app.put("/api/posts/reorder", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validatedData = reorderSchema.parse(req.body);
      await storage.reorderPosts(validatedData.updates);
      await recalculateApprovedPostsDates(userId);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error reordering posts:", error);
      res.status(500).json({ error: "Failed to reorder posts" });
    }
  });

  // Get single post (scoped to current user)
  app.get("/api/posts/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const post = await storage.getPost(req.params.id);
      if (!post || post.userId !== userId) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      console.error("Error fetching post:", error);
      res.status(500).json({ error: "Failed to fetch post" });
    }
  });

  // Create post (scoped to current user)
  app.post("/api/posts", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validatedData = insertPostSchema.parse(req.body);

      // Calculate order if not provided
      if (validatedData.order === undefined) {
        const allPosts = await storage.getAllPosts(userId);
        const maxOrder = allPosts.length > 0 ? Math.max(...allPosts.map(p => p.order)) : 0;
        validatedData.order = maxOrder + 1;
      }

      const post = await storage.createPost({ ...validatedData, userId } as any);
      res.status(201).json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // Update post (content, images, scheduledDate) - scoped to current user
  app.put("/api/posts/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const existingPost = await storage.getPost(req.params.id);
      if (!existingPost || existingPost.userId !== userId) {
        return res.status(404).json({ error: "Post not found" });
      }

      const validatedData = updatePostSchema.parse(req.body);
      const post = await storage.updatePost(req.params.id, validatedData);
      res.json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating post:", error);
      res.status(500).json({ error: "Failed to update post" });
    }
  });

  // Update post status (approve/reject) - scoped to current user
  app.patch("/api/posts/:id/status", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const existingPost = await storage.getPost(req.params.id);
      if (!existingPost || existingPost.userId !== userId) {
        return res.status(404).json({ error: "Post not found" });
      }

      const { status } = req.body;
      const validatedStatus = postStatusEnum.parse(status);
      const post = await storage.updatePostStatus(req.params.id, validatedStatus, userId);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      // Recalculate all approved posts dates after status change
      if (validatedStatus === "approved" || validatedStatus === "rejected" || validatedStatus === "pending") {
        await recalculateApprovedPostsDates(userId);
      }

      // Fetch updated post with new scheduled date
      const updatedPost = await storage.getPost(req.params.id);
      res.json(updatedPost || post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid status. Must be pending, approved, rejected, or draft" });
      }
      console.error("Error updating post status:", error);
      res.status(500).json({ error: "Failed to update post status" });
    }
  });

  // Regenerate caption using AI - scoped to current user
  app.post("/api/posts/:id/regenerate-caption", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const post = await storage.getPost(req.params.id);
      if (!post || post.userId !== userId) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (post.status === "approved") {
        return res.status(400).json({ error: "Cannot regenerate caption for approved posts. Send back to review first." });
      }

      if (!isOpenAIConfigured()) {
        return res.status(503).json({ error: "AI caption generation unavailable. OPENAI_API_KEY not configured." });
      }

      const result = await regenerateCaption(post.content, post.images || undefined);

      if (!result.success || !result.caption) {
        return res.status(500).json({ error: result.error || "Failed to regenerate caption" });
      }

      // Update the post with the new caption
      const updatedPost = await storage.updatePost(post.id, { content: result.caption });

      res.json({ success: true, caption: result.caption, post: updatedPost });
    } catch (error) {
      console.error("Error regenerating caption:", error);
      res.status(500).json({ error: "Failed to regenerate caption" });
    }
  });

  // Delete post - scoped to current user
  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const existingPost = await storage.getPost(req.params.id);
      if (!existingPost || existingPost.userId !== userId) {
        return res.status(404).json({ error: "Post not found" });
      }

      const deleted = await storage.deletePost(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  // Seed initial data if database is empty AND create demo/jackfoley users
  app.post("/api/seed", async (_req, res) => {
    try {
      // Always ensure jackfoley user exists (password: ADP)
      let jackfoleyUser = await storage.getUserByUsername("jackfoley");
      if (!jackfoleyUser) {
        const hashedPassword = await hashPassword("ADP");
        jackfoleyUser = await storage.createUser({ username: "jackfoley", password: hashedPassword });
        console.log("Created jackfoley user:", jackfoleyUser.id);
      } else {
        // Reset password to 'ADP' for existing user
        const hashedPassword = await hashPassword("ADP");
        await storage.updateUserPassword(jackfoleyUser.id, hashedPassword);
        console.log("Reset jackfoley password:", jackfoleyUser.id);
      }

      // Always ensure demo user exists
      let demoUser = await storage.getUserByUsername("demo");
      if (!demoUser) {
        const hashedPassword = await hashPassword("demo");
        demoUser = await storage.createUser({ username: "demo", password: hashedPassword });
        console.log("Created demo user:", demoUser.id);
      }

      // Migrate any posts without userId to jackfoley (existing data migration)
      const allPosts = await storage.getAllPosts();
      const unownedPosts = allPosts.filter(p => !p.userId);
      if (unownedPosts.length > 0) {
        for (const post of unownedPosts) {
          await storage.updatePost(post.id, { userId: jackfoleyUser.id } as any);
        }
        console.log(`Migrated ${unownedPosts.length} unowned posts to jackfoley`);
      }

      // Migrate any photos without userId to jackfoley (existing data migration)
      const allPhotos = await storage.getAllTaggedPhotos();
      const unownedPhotos = allPhotos.filter(p => !p.userId);
      if (unownedPhotos.length > 0) {
        for (const photo of unownedPhotos) {
          await storage.updateTaggedPhoto(photo.id, { userId: jackfoleyUser.id } as any);
        }
        console.log(`Migrated ${unownedPhotos.length} unowned photos to jackfoley`);
      }

      const existingPosts = await storage.getAllPosts();
      if (existingPosts.length > 0) {
        return res.json({ message: "Database already has data", count: existingPosts.length, demoUserCreated: !!demoUser });
      }

      // Generate future dates relative to today
      const today = new Date();
      const addDays = (days: number, hour: number = 10) => {
        const date = new Date(today);
        date.setDate(date.getDate() + days);
        date.setHours(hour, 0, 0, 0);
        return date;
      };

      const seedPosts = [
        {
          content: "Excited to announce our new product launch! Stay tuned for more updates coming next week. We can't wait to share what we've been working on.",
          status: "pending" as const,
          scheduledDate: addDays(3, 10),
          images: [
            "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=600&fit=crop",
            "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&h=600&fit=crop",
            "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&h=600&fit=crop",
          ],
          order: 1,
        },
        {
          content: "Join us for our upcoming webinar on digital marketing strategies. Learn from industry experts and take your business to the next level.",
          status: "pending" as const,
          scheduledDate: addDays(4, 14),
          images: ["https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=600&fit=crop"],
          order: 2,
        },
        {
          content: "Happy Friday everyone! What are your weekend plans? Let us know in the comments below.",
          status: "approved" as const,
          scheduledDate: addDays(1, 9),
          images: [
            "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=600&fit=crop",
            "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&h=600&fit=crop",
          ],
          order: 3,
        },
        {
          content: "Check out our latest blog post about sustainable business practices. Link in bio!",
          status: "rejected" as const,
          scheduledDate: addDays(2, 11),
          images: null,
          order: 4,
        },
        {
          content: "Behind the scenes of our latest photoshoot. Stay tuned for the full reveal!",
          status: "pending" as const,
          scheduledDate: addDays(5, 16),
          images: [
            "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&h=600&fit=crop",
            "https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=600&h=600&fit=crop",
            "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=600&fit=crop",
            "https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=600&h=600&fit=crop",
          ],
          order: 5,
        },
        {
          content: "We're hiring! Join our growing team and be part of something amazing. Check out our careers page for open positions.",
          status: "approved" as const,
          scheduledDate: addDays(6, 8),
          images: ["https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=600&fit=crop"],
          order: 6,
        },
        {
          content: "Thank you to all our customers for making this year incredible. Here's to an even better next year!",
          status: "pending" as const,
          scheduledDate: addDays(8, 12),
          images: null,
          order: 7,
        },
        {
          content: "Quick tip: Always proofread your content before posting. A small typo can make a big difference!",
          status: "pending" as const,
          scheduledDate: addDays(7, 15),
          images: [
            "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=600&fit=crop",
            "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=600&h=600&fit=crop",
          ],
          order: 8,
        },
      ];

      for (const post of seedPosts) {
        await storage.createPost({ ...post, userId: demoUser.id });
      }

      res.json({ message: "Database seeded successfully", count: seedPosts.length, demoUserId: demoUser.id });
    } catch (error) {
      console.error("Error seeding database:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to seed database", details: errorMessage });
    }
  });

  // AI-powered post generation (no webhooks, all server-side)
  app.post("/api/generate-posts", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { topics, maxPhotos = 10 } = req.body;

      if (!topics || !Array.isArray(topics) || topics.length === 0) {
        return res.status(400).json({ error: "topics array is required" });
      }

      if (!isPostGenerationAvailable()) {
        return res.status(503).json({
          error: "Post generation unavailable. OPENAI_API_KEY not configured."
        });
      }

      // Fetch all available tagged photos (shared library)
      const allPhotos = await storage.getAllTaggedPhotos();

      if (allPhotos.length === 0) {
        return res.status(400).json({
          error: "No photos in library. Upload photos first."
        });
      }

      // Convert to PhotoForAI format
      const photosForAI: PhotoForAI[] = allPhotos.map((photo) => ({
        id: photo.id,
        tags: photo.tags?.join(", ") || "",
        description: photo.description || photo.originalFilename || undefined,
      }));

      console.log(`[Generate Posts] Starting generation for ${topics.length} topics with ${photosForAI.length} available photos`);

      const results: Array<{
        topic: string;
        success: boolean;
        postId?: string;
        photoIds?: string[];
        caption?: string;
        error?: string;
      }> = [];

      // Process topics with capped concurrency (2 at a time)
      const CONCURRENCY = 2;
      const queue = [...topics];
      const inProgress: Promise<void>[] = [];

      const processTopic = async (topic: string) => {
        const trimmedTopic = topic.trim();
        if (!trimmedTopic) {
          results.push({ topic, success: false, error: "Empty topic" });
          return;
        }

        try {
          // Generate post (curator + caption)
          const genResult = await generatePost(trimmedTopic, photosForAI);

          if (!genResult.success) {
            results.push({
              topic: trimmedTopic,
              success: false,
              error: genResult.error,
            });
            return;
          }

          // Map photo IDs to photo URLs for the post
          const photoIdSet = new Set(genResult.photoIds);
          const selectedPhotos = allPhotos.filter((p) => photoIdSet.has(p.id));
          const imageUrls = selectedPhotos.map((p) => p.photoUrl);

          // Calculate order - new posts go to the top
          const allPosts = await storage.getAllPosts(userId);
          const pendingPosts = allPosts.filter((p) => p.status === "pending");

          // Shift existing pending posts down
          for (const pendingPost of pendingPosts) {
            await storage.updatePost(pendingPost.id, { order: pendingPost.order + 1 });
          }

          // Calculate scheduled date (tomorrow at 5:00 PM)
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + 1);
          scheduledDate.setHours(17, 0, 0, 0);

          // Create the post (with userId)
          const post = await storage.createPost({
            content: genResult.caption,
            status: "pending",
            images: imageUrls.length > 0 ? imageUrls : null,
            order: 0,
            scheduledDate,
            userId,
          });

          console.log(`[Generate Posts] Created post ${post.id} for topic: "${trimmedTopic}"`);

          results.push({
            topic: trimmedTopic,
            success: true,
            postId: post.id,
            photoIds: genResult.photoIds,
            caption: genResult.caption,
          });
        } catch (error) {
          console.error(`[Generate Posts] Error for topic "${trimmedTopic}":`, error);
          results.push({
            topic: trimmedTopic,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      };

      // Process with concurrency limit
      while (queue.length > 0 || inProgress.length > 0) {
        while (queue.length > 0 && inProgress.length < CONCURRENCY) {
          const topic = queue.shift()!;
          const promise = processTopic(topic).finally(() => {
            const index = inProgress.indexOf(promise);
            if (index > -1) inProgress.splice(index, 1);
          });
          inProgress.push(promise);
        }
        if (inProgress.length > 0) {
          await Promise.race(inProgress);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      console.log(`[Generate Posts] Complete: ${successCount} succeeded, ${failCount} failed`);

      res.json({
        success: failCount === 0,
        message: `${successCount} post(s) generated${failCount > 0 ? `, ${failCount} failed` : ""}`,
        results,
      });
    } catch (error) {
      console.error("[Generate Posts] Error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to generate posts",
      });
    }
  });

  // Legacy: Trigger n8n webhook to generate posts (kept for backward compatibility)
  app.post("/api/trigger-generate", async (req, res) => {
    try {
      const { topics } = req.body;
      const n8nWebhookUrl = "https://liamfraz3.app.n8n.cloud/webhook/0d25b57d-4af4-4526-8bfe-2d89247c713f";
      
      // Send each topic as a separate request to n8n
      const topicsArray = Array.isArray(topics) ? topics : [topics || "general content"];
      
      for (const topic of topicsArray) {
        await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ topic }),
        });
      }
      
      console.log("n8n webhook triggered for", topicsArray.length, "topics");
      res.json({ success: true, message: "Generation triggered", count: topicsArray.length });
    } catch (error) {
      console.error("Error triggering n8n webhook:", error);
      res.status(500).json({ error: "Failed to trigger generation" });
    }
  });

  // Webhook endpoint for n8n to create posts
  app.post("/api/webhook/posts", async (req, res) => {
    try {
      console.log("Webhook received:", JSON.stringify(req.body, null, 2));

      let postCaption = "";
      let postStatus = "";
      let postUsername = "";
      const images: string[] = [];
      
      // Helper function to extract URL from =IMAGE("url") format
      const extractImageUrl = (value: string): string | null => {
        if (!value || typeof value !== 'string') return null;
        // Match =IMAGE("...") format from Google Sheets
        const match = value.match(/=IMAGE\("([^"]+)"\)/i);
        if (match) return match[1];
        // If it's already a plain URL, return it
        if (value.startsWith('http')) return value;
        return null;
      };
      
      // Helper function to unwrap n8n JSON wrappers
      const unwrapN8nData = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;
        if (obj.JSON && typeof obj.JSON === 'object') return obj.JSON;
        if (obj.json && typeof obj.json === 'object') return obj.json;
        return obj;
      };
      
      // Handle merge node format: { data: [{imageUrl}, {output}, {allFileIDs}] } or [{ data: [...] }]
      let dataArray: any[] | null = null;
      
      if (req.body && req.body.data && Array.isArray(req.body.data)) {
        // Direct object format: { data: [...] }
        dataArray = req.body.data;
      } else if (Array.isArray(req.body) && req.body.length === 1 && req.body[0].data && Array.isArray(req.body[0].data)) {
        // Wrapped array format: [{ data: [...] }]
        dataArray = req.body[0].data;
      } else if (Array.isArray(req.body) && req.body.length >= 2) {
        // Direct array format: [{...}, {...}, {...}]
        dataArray = req.body;
      }
      
      if (dataArray && dataArray.length >= 2) {
        // First pass: collect all imageUrl values and extract caption/status/username
        for (const item of dataArray) {
          const unwrapped = unwrapN8nData(item);

          // Extract output/caption
          if (unwrapped.output && typeof unwrapped.output === 'string' && !postCaption) {
            postCaption = unwrapped.output;
          }
          if ((unwrapped.caption || unwrapped.Caption) && !postCaption) {
            postCaption = unwrapped.caption || unwrapped.Caption;
          }

          // Extract status
          if ((unwrapped.status || unwrapped.Status) && !postStatus) {
            postStatus = unwrapped.status || unwrapped.Status;
          }

          // Extract username
          if ((unwrapped.username || unwrapped.Username) && !postUsername) {
            postUsername = unwrapped.username || unwrapped.Username;
          }

          // Collect individual imageUrl values (prioritize these)
          if (unwrapped.imageUrl && typeof unwrapped.imageUrl === 'string') {
            if (!images.includes(unwrapped.imageUrl)) {
              images.push(unwrapped.imageUrl);
            }
          }
        }
        
        // If no images from imageUrl fields, try allFileIDs as fallback
        if (images.length === 0) {
          for (const item of dataArray) {
            const unwrapped = unwrapN8nData(item);
            if (unwrapped.allFileIDs && typeof unwrapped.allFileIDs === 'string') {
              const fileIds = unwrapped.allFileIDs.split(',').map((id: string) => id.trim()).filter((id: string) => id);
              for (const fileId of fileIds) {
                images.push(`https://lh3.googleusercontent.com/d/${fileId}=w800-h800`);
              }
              break; // Only process allFileIDs once
            }
          }
        }
      } else {
        // Fallback: Handle single object format (legacy or n8n per-item mode)
        let data = Array.isArray(req.body) ? req.body[0] : req.body;
        
        // Unwrap nested JSON from n8n (handles "JSON" or similar wrapper keys)
        if (data && typeof data === 'object') {
          if (data.JSON && typeof data.JSON === 'object') {
            data = data.JSON;
          } else if (data.json && typeof data.json === 'object') {
            data = data.json;
          }
        }
        
        if (!data) {
          return res.status(400).json({ error: "No data provided" });
        }
        
        // Handle single object with output field (n8n sending items one by one)
        if (data.output && typeof data.output === 'string') {
          postCaption = data.output;
        }
        
        // Handle allFileIDs in single object
        if (data.allFileIDs && typeof data.allFileIDs === 'string') {
          const fileIds = data.allFileIDs.split(',').map((id: string) => id.trim()).filter((id: string) => id);
          for (const fileId of fileIds) {
            images.push(`https://lh3.googleusercontent.com/d/${fileId}=w800-h800`);
          }
        }
        
        const { status, caption, Status, Caption, username, Username } = data;
        postStatus = status || Status || postStatus || "";
        if (!postCaption) {
          postCaption = caption || Caption || "";
        }
        if (!postUsername) {
          postUsername = username || Username || "";
        }
        
        // Collect all images from Image 1 through Image 10 (legacy format with space)
        for (let i = 1; i <= 10; i++) {
          const imageKey = `Image ${i}`;
          const imageUrl = data[imageKey];
          if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
            const extractedUrl = extractImageUrl(imageUrl);
            if (extractedUrl) {
              images.push(extractedUrl);
            } else {
              images.push(imageUrl.trim());
            }
          }
        }
        
        // Also check if images array is provided directly
        if (data.images && Array.isArray(data.images)) {
          for (const img of data.images) {
            if (img && typeof img === 'string' && img.trim() !== '') {
              images.push(img.trim());
            }
          }
        }
        
        // Check for single imageUrl field
        if (images.length === 0 && data.imageUrl && typeof data.imageUrl === 'string') {
          images.push(data.imageUrl);
        }
      }
      
      // Trim and validate caption
      postCaption = postCaption.trim();
      if (!postCaption) {
        return res.status(400).json({ error: "Caption/content is required" });
      }
      
      // Map status from n8n to our status enum
      // n8n sends "Review" which maps to "pending"
      let mappedStatus: "pending" | "approved" | "rejected" | "draft" = "pending";
      if (postStatus) {
        const statusLower = postStatus.toLowerCase();
        if (statusLower === "review" || statusLower === "pending") {
          mappedStatus = "pending";
        } else if (statusLower === "approved" || statusLower === "approve") {
          mappedStatus = "approved";
        } else if (statusLower === "rejected" || statusLower === "reject") {
          mappedStatus = "rejected";
        } else if (statusLower === "draft") {
          mappedStatus = "draft";
        }
      }
      
      // Look up user by username if provided
      let userId: string | null = null;
      if (postUsername) {
        const user = await storage.getUserByUsername(postUsername);
        if (user) {
          userId = user.id;
          console.log(`Webhook post will be assigned to user: ${postUsername} (${userId})`);
        } else {
          console.log(`Warning: Username '${postUsername}' not found, post will not be assigned to any user`);
        }
      }

      // Get all pending posts (scoped to user if available) and shift their order
      const allPosts = await storage.getAllPosts(userId || undefined);
      const pendingPosts = allPosts.filter(p => p.status === "pending");

      // Shift all existing pending posts down by 1
      for (const pendingPost of pendingPosts) {
        await storage.updatePost(pendingPost.id, { order: pendingPost.order + 1 });
      }

      // Calculate scheduled date (tomorrow at 5:00 PM)
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      scheduledDate.setHours(17, 0, 0, 0);

      // Create the post at the top (order = 0)
      const post = await storage.createPost({
        content: postCaption,
        status: mappedStatus,
        images: images.length > 0 ? images : null,
        order: 0,
        scheduledDate,
        userId,
      });

      console.log("Post created via webhook:", post.id, userId ? `for user ${postUsername}` : "(no user)");
      res.status(201).json({ success: true, postId: post.id, message: "Post created successfully" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Serve uploaded files statically
  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(UPLOADS_DIR, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Upload and tag photos endpoint (scoped to user)
  app.post("/api/photos/upload-and-tag", upload.array("photos", 20), async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Handle folder assignment - can provide folderId or folderName
      let folderId: string | null = null;
      const { folderId: providedFolderId, folderName } = req.body;

      if (providedFolderId) {
        // Use existing folder
        folderId = providedFolderId;
      } else if (folderName && typeof folderName === "string" && folderName.trim()) {
        // Create new folder with the provided name
        const folder = await storage.createPhotoFolder({ name: folderName.trim(), userId });
        folderId = folder.id;
        console.log(`Created new folder "${folderName}" with ID ${folderId}`);
      }

      console.log(`Processing ${files.length} uploaded files for user ${userId}${folderId ? ` into folder ${folderId}` : ""}...`);

      const results: Array<{
        success: boolean;
        filename: string;
        photo?: any;
        error?: string;
      }> = [];

      // Process files (already uploaded by multer)
      for (const file of files) {
        try {
          const filePath = file.path;
          const photoUrl = `/uploads/${file.filename}`;

          // Analyze image with OpenAI Vision
          let tags: string[] = [];
          if (isOpenAIConfigured()) {
            console.log(`Analyzing image: ${file.originalname}`);
            const taggingResult = await analyzeImageForTags(filePath);
            if (taggingResult.success) {
              tags = taggingResult.tags;
              console.log(`Tags for ${file.originalname}:`, tags);
            } else {
              console.warn(`Failed to tag ${file.originalname}:`, taggingResult.error);
            }
          } else {
            console.warn("OpenAI not configured, skipping tagging");
          }

          // Create tagged photo record in database (with userId and optional folderId)
          const photo = await storage.createTaggedPhoto({
            photoId: file.filename,
            photoUrl: photoUrl,
            description: file.originalname,
            tags: tags.length > 0 ? tags : null,
            originalFilename: file.originalname,
            storagePath: filePath,
            userId,
            folderId,
          });

          results.push({
            success: true,
            filename: file.originalname,
            photo,
          });
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          // Try to clean up the uploaded file
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch {}

          results.push({
            success: false,
            filename: file.originalname,
            error: fileError instanceof Error ? fileError.message : "Unknown error",
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      console.log(`Upload complete: ${successCount} succeeded, ${failCount} failed`);

      res.json({
        success: failCount === 0,
        message: `${successCount} photo(s) uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ""}`,
        results,
        folderId,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to upload photos"
      });
    }
  });

  // Error handler for multer errors
  app.use((err: any, req: Request, res: Response, next: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err.message && err.message.includes("Invalid file type")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  });

  // Webhook endpoint for n8n to create tagged photos
  app.post("/api/webhook/tagged-photos", async (req, res) => {
    try {
      console.log("Tagged photos webhook received:", JSON.stringify(req.body, null, 2));
      
      // Handle both single object and array format from n8n
      let data = Array.isArray(req.body) ? req.body[0] : req.body;
      
      // Unwrap nested JSON from n8n (handles "JSON" or similar wrapper keys)
      if (data && typeof data === 'object') {
        if (data.JSON && typeof data.JSON === 'object') {
          data = data.JSON;
        } else if (data.json && typeof data.json === 'object') {
          data = data.json;
        }
      }
      
      if (!data) {
        return res.status(400).json({ error: "No data provided" });
      }
      
      // Extract fields from n8n format
      // Expected format: { Image, filename, url, tags, uploadDate, username }
      const { filename, url, tags, uploadDate, Image, username } = data;
      
      // Look up user by username if provided
      let userId: string | null = null;
      if (username) {
        const user = await storage.getUserByUsername(username);
        if (user) {
          userId = user.id;
          console.log(`Tagged photo will be assigned to user: ${username} (${userId})`);
        } else {
          console.log(`Warning: Username '${username}' not found, photo will not be assigned to any user`);
        }
      }
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Extract Google Drive file ID from URL
      // Formats: https://drive.google.com/file/d/{fileId}/view?usp=drivesdk
      //          https://drive.google.com/open?id={fileId}
      let fileId = '';
      const driveFileMatch = url.match(/\/file\/d\/([^\/]+)/);
      const driveOpenMatch = url.match(/[?&]id=([^&]+)/);
      
      if (driveFileMatch) {
        fileId = driveFileMatch[1];
      } else if (driveOpenMatch) {
        fileId = driveOpenMatch[1];
      } else {
        // If no match, use the url as-is (might be a direct link)
        fileId = url;
      }
      
      // Convert to displayable Google Drive image URL
      const displayableUrl = fileId.startsWith('http') 
        ? fileId 
        : `https://lh3.googleusercontent.com/d/${fileId}=w800-h800`;
      
      // Parse tags - can be comma-separated string or array
      let parsedTags: string[] = [];
      if (tags) {
        if (Array.isArray(tags)) {
          parsedTags = tags.map((t: string) => t.trim()).filter(Boolean);
        } else if (typeof tags === 'string') {
          parsedTags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
      }
      
      // Generate a unique photoId from filename or timestamp
      const photoId = filename || `photo-${Date.now()}`;
      
      // Create the tagged photo with userId if available
      const photo = await storage.createTaggedPhoto({
        photoId,
        photoUrl: displayableUrl,
        description: filename || null,
        tags: parsedTags.length > 0 ? parsedTags : null,
      }, userId || undefined);
      
      console.log("Tagged photo created via webhook:", photo.id);
      res.status(201).json({ success: true, photoId: photo.id, message: "Tagged photo created successfully" });
    } catch (error) {
      console.error("Tagged photos webhook error:", error);
      res.status(500).json({ error: "Failed to process tagged photos webhook" });
    }
  });

  // Debug endpoint: direct database count (no ORM)
  app.get("/api/debug/tagged-photos-count", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM tagged_photos`);
      const count = Number(result.rows?.[0]?.count || result[0]?.count || 0);
      console.log(`Debug count endpoint: ${count} photos in database`);
      res.json({ count });
    } catch (error) {
      console.error("Debug count error:", error);
      res.status(500).json({ error: "Failed to get count", details: String(error) });
    }
  });

  // Photo Folders routes
  app.get("/api/photo-folders", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const folders = await storage.getAllPhotoFolders(userId);
      res.json(folders);
    } catch (error) {
      console.error("Error fetching photo folders:", error);
      res.status(500).json({ error: "Failed to fetch photo folders" });
    }
  });

  app.get("/api/photo-folders/:id", async (req, res) => {
    try {
      const folder = await storage.getPhotoFolder(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      res.json(folder);
    } catch (error) {
      console.error("Error fetching photo folder:", error);
      res.status(500).json({ error: "Failed to fetch photo folder" });
    }
  });

  app.get("/api/photo-folders/:id/photos", async (req, res) => {
    try {
      const photos = await storage.getPhotosInFolder(req.params.id);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching photos in folder:", error);
      res.status(500).json({ error: "Failed to fetch photos in folder" });
    }
  });

  app.get("/api/photo-folders-without-folder", async (req, res) => {
    try {
      const photos = await storage.getPhotosWithoutFolder();
      res.json(photos);
    } catch (error) {
      console.error("Error fetching photos without folder:", error);
      res.status(500).json({ error: "Failed to fetch photos without folder" });
    }
  });

  app.post("/api/photo-folders", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { name } = req.body;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Folder name is required" });
      }
      const folder = await storage.createPhotoFolder({ name, userId });
      res.status(201).json(folder);
    } catch (error) {
      console.error("Error creating photo folder:", error);
      res.status(500).json({ error: "Failed to create photo folder" });
    }
  });

  app.put("/api/photo-folders/:id", async (req, res) => {
    try {
      const { name } = req.body;
      const folder = await storage.updatePhotoFolder(req.params.id, { name });
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      res.json(folder);
    } catch (error) {
      console.error("Error updating photo folder:", error);
      res.status(500).json({ error: "Failed to update photo folder" });
    }
  });

  app.delete("/api/photo-folders/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePhotoFolder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Folder not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting photo folder:", error);
      res.status(500).json({ error: "Failed to delete photo folder" });
    }
  });

  // Tagged Photos routes (scoped by user)
  app.get("/api/tagged-photos", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const photos = await storage.getAllTaggedPhotos(userId);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching tagged photos:", error);
      res.status(500).json({ error: "Failed to fetch tagged photos" });
    }
  });

  // Get unassigned tagged photos (photos with no userId)
  app.get("/api/tagged-photos/unassigned", async (req, res) => {
    try {
      const photos = await storage.getUnassignedTaggedPhotos();
      console.log(`Found ${photos.length} unassigned photos`);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching unassigned photos:", error);
      res.status(500).json({ error: "Failed to fetch unassigned photos" });
    }
  });

  // Get available tagged photos (not yet posted)
  app.get("/api/tagged-photos/available", async (req, res) => {
    try {
      const photos = await storage.getAvailableTaggedPhotos();
      res.json(photos);
    } catch (error) {
      console.error("Error fetching available photos:", error);
      res.status(500).json({ error: "Failed to fetch available photos" });
    }
  });

  // Get posted tagged photos
  app.get("/api/tagged-photos/posted", async (req, res) => {
    try {
      const photos = await storage.getPostedTaggedPhotos();
      res.json(photos);
    } catch (error) {
      console.error("Error fetching posted photos:", error);
      res.status(500).json({ error: "Failed to fetch posted photos" });
    }
  });

  // Get photos that are currently in prepared posts (draft/pending/approved - not yet posted)
  app.get("/api/tagged-photos/in-posts", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      // Get all posts that are not yet posted (scoped to user)
      const allPosts = await storage.getAllPosts(userId);
      const preparedPosts = allPosts.filter(p =>
        p.status === "draft" || p.status === "pending" || p.status === "approved"
      );

      // Collect all image URLs from these posts
      const imageUrlsInPosts = new Set<string>();
      for (const post of preparedPosts) {
        if (post.images && post.images.length > 0) {
          for (const img of post.images) {
            imageUrlsInPosts.add(img);
          }
        }
      }

      res.json(Array.from(imageUrlsInPosts));
    } catch (error) {
      console.error("Error fetching photos in posts:", error);
      res.status(500).json({ error: "Failed to fetch photos in posts" });
    }
  });

  // Debug endpoint to see all photos in database (for troubleshooting)
  app.get("/api/tagged-photos/debug-all", async (req, res) => {
    try {
      const allPhotos = await storage.getAllTaggedPhotos(); // Get ALL photos (no userId filter)
      const userId = req.session.userId;
      console.log(`Debug: Total photos in DB: ${allPhotos.length}, logged in userId: ${userId}`);
      res.json({
        totalPhotos: allPhotos.length,
        loggedInUserId: userId,
        photos: allPhotos.map(p => ({ id: p.id, userId: p.userId, photoUrl: p.photoUrl?.substring(0, 50) }))
      });
    } catch (error) {
      console.error("Error in debug endpoint:", error);
      res.status(500).json({ error: "Debug failed" });
    }
  });

  // Claim unassigned photos (single-user mode - just acknowledge)
  app.post("/api/tagged-photos/claim", async (req, res) => {
    try {
      const { photoIds } = req.body;
      
      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ error: "photoIds array is required" });
      }
      
      // In single-user mode, all photos are already visible - just return success
      res.json({ success: true, claimedCount: photoIds.length, message: `${photoIds.length} photos claimed successfully` });
    } catch (error) {
      console.error("Error claiming photos:", error);
      res.status(500).json({ error: "Failed to claim photos" });
    }
  });

  app.get("/api/tagged-photos/:id", async (req, res) => {
    try {
      const photo = await storage.getTaggedPhoto(req.params.id);
      if (!photo) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.json(photo);
    } catch (error) {
      console.error("Error fetching photo:", error);
      res.status(500).json({ error: "Failed to fetch photo" });
    }
  });

  app.post("/api/tagged-photos", async (req, res) => {
    try {
      const validatedData = insertTaggedPhotoSchema.parse(req.body);
      const photo = await storage.createTaggedPhoto(validatedData);
      res.status(201).json(photo);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating photo:", error);
      res.status(500).json({ error: "Failed to create photo" });
    }
  });

  app.put("/api/tagged-photos/:id", async (req, res) => {
    try {
      const existingPhoto = await storage.getTaggedPhoto(req.params.id);
      if (!existingPhoto) {
        return res.status(404).json({ error: "Photo not found" });
      }
      
      const validatedData = updateTaggedPhotoSchema.parse(req.body);
      const photo = await storage.updateTaggedPhoto(req.params.id, validatedData);
      res.json(photo);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating photo:", error);
      res.status(500).json({ error: "Failed to update photo" });
    }
  });

  app.delete("/api/tagged-photos/:id", async (req, res) => {
    try {
      const dbId = req.params.id;
      
      // Fetch the photo first to get the Google Drive ID from the URL
      const photo = await storage.getTaggedPhoto(dbId);
      if (!photo) {
        return res.status(404).json({ error: "Photo not found" });
      }
      
      // Extract Google Drive file ID from the photoUrl
      // Format: https://lh3.googleusercontent.com/d/{GOOGLE_DRIVE_ID}=w800-h800
      let googleDriveId = "";
      const urlMatch = photo.photoUrl.match(/\/d\/([^=]+)/);
      if (urlMatch && urlMatch[1]) {
        googleDriveId = urlMatch[1];
      }
      
      const deleted = await storage.deleteTaggedPhoto(dbId);
      if (!deleted) {
        return res.status(404).json({ error: "Photo not found" });
      }
      
      // Send Google Drive photo ID to n8n webhook (fire and forget)
      const webhookUrl = "https://liamfraz3.app.n8n.cloud/webhook/5fca8a1e-2e8d-43d9-a2e7-363655728c98";
      console.log("Sending photo deletion to n8n:", { googleDriveId, webhookUrl });
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: googleDriveId }),
      }).then((response) => {
        console.log("n8n webhook response:", response.status);
      }).catch((err) => {
        console.error("Failed to notify n8n of photo deletion:", err);
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ error: "Failed to delete photo" });
    }
  });

  // Posting Settings endpoints
  app.get("/api/posting-settings", async (_req, res) => {
    try {
      const settings = await storage.getPostingSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching posting settings:", error);
      res.status(500).json({ error: "Failed to fetch posting settings" });
    }
  });

  app.patch("/api/posting-settings", async (req, res) => {
    try {
      const { isPaused } = req.body;
      const settings = await storage.updatePostingSettings({
        isPaused: isPaused ? "true" : "false",
      });
      res.json(settings);
    } catch (error) {
      console.error("Error updating posting settings:", error);
      res.status(500).json({ error: "Failed to update posting settings" });
    }
  });

  // Recalculate dates endpoint (for initial setup) - scoped to user
  app.post("/api/posts/recalculate-dates", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      await recalculateApprovedPostsDates(userId);
      res.json({ success: true, message: "Dates recalculated" });
    } catch (error) {
      console.error("Error recalculating dates:", error);
      res.status(500).json({ error: "Failed to recalculate dates" });
    }
  });

  // Debug endpoint to see webhook payload without sending
  app.get("/api/posts/:id/debug-webhook", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const post = await storage.getPost(req.params.id);
      if (!post || post.userId !== userId) {
        return res.status(404).json({ error: "Post not found" });
      }

      // Convert local image paths to full URLs (same logic as post-now)
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000";
      const baseUrl = `${protocol}://${host}`;

      const imageUrls = (post.images || []).map((img) => {
        if (img.startsWith("/")) {
          return `${baseUrl}${img}`;
        }
        return img;
      });

      res.json({
        webhookUrl: POSTING_WEBHOOK_URL,
        payload: {
          postId: post.id,
          caption: post.content,
          images: imageUrls,
          rawImages: post.images,
          collaborators: post.collaborators || [],
          scheduledDate: post.scheduledDate,
          manualPost: true,
        },
      });
    } catch (error) {
      console.error("Error in debug-webhook:", error);
      res.status(500).json({ error: "Failed to get debug info" });
    }
  });

  // Manual post endpoint - sends a post to webhook immediately (scoped to user)
  app.post("/api/posts/:id/post-now", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const post = await storage.getPost(req.params.id);
      if (!post || post.userId !== userId) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (!POSTING_WEBHOOK_URL) {
        return res.status(400).json({ error: "No webhook URL configured" });
      }

      console.log(`Manual posting: Sending post ${post.id} to webhook...`);

      // Convert local image paths to full URLs
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000";
      const baseUrl = `${protocol}://${host}`;

      const imageUrls = (post.images || []).map((img) => {
        if (img.startsWith("/")) {
          return `${baseUrl}${img}`;
        }
        return img;
      });

      console.log(`Webhook URL: ${POSTING_WEBHOOK_URL}`);
      console.log(`Post data:`, JSON.stringify({
        postId: post.id,
        caption: post.content?.substring(0, 100) + "...",
        imageCount: imageUrls.length,
        images: imageUrls,
      }));

      // Send to n8n webhook with 2-minute timeout for Instagram uploads
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(POSTING_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: post.id,
          caption: post.content,
          images: imageUrls,
          collaborators: post.collaborators || [],
          scheduledDate: post.scheduledDate,
          manualPost: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // HTTP 200 from n8n means the workflow accepted the post
        // Accept empty response or explicit success confirmation
        let responseMessage = "";
        try {
          const text = await response.text();
          if (text) {
            const responseData = JSON.parse(text);
            console.log(`Webhook response for post ${post.id}:`, JSON.stringify(responseData));
            responseMessage = responseData.message || "";
          } else {
            console.log(`Webhook returned 200 OK with empty body for post ${post.id}`);
          }
        } catch (parseError) {
          console.log(`Non-JSON response from webhook for post ${post.id}, treating as success`);
        }

        // Move post to "posted" status since n8n returned 200 OK
        await storage.updatePostStatus(post.id, "posted", userId);
        // Mark any tagged photos used in this post as "posted"
        if (post.images && post.images.length > 0) {
          const markedCount = await storage.markPhotosAsPosted(post.images);
          console.log(`Marked ${markedCount} tagged photos as posted for post ${post.id}`);
        }
        // Recalculate remaining approved posts dates
        await recalculateApprovedPostsDates(userId);
        console.log(`Manual post ${post.id} sent to n8n and moved to 'posted' status`);
        res.json({ success: true, message: responseMessage || "Post sent successfully" });
      } else {
        console.error(`Failed to manually send post ${post.id} to webhook:`, response.status);
        res.status(500).json({ error: `Webhook returned ${response.status}` });
      }
    } catch (error: any) {
      console.error("Error manually posting:", error);
      if (error.name === "AbortError") {
        res.status(504).json({ error: "Webhook timed out after 2 minutes. Check if your n8n workflow is running." });
      } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        res.status(502).json({ error: "Could not connect to webhook URL. Check if n8n is running." });
      } else {
        res.status(500).json({ error: `Failed to send post: ${error.message || "Unknown error"}` });
      }
    }
  });

  // =============================================
  // Instagram OAuth & Posting Endpoints
  // =============================================

  // Check if Instagram is configured
  app.get("/api/instagram/status", async (req, res) => {
    try {
      const configured = isInstagramConfigured();
      const userId = req.session.userId;

      let connected = false;
      let instagramUsername = null;

      if (userId) {
        const credentials = await storage.getInstagramCredentials(userId);
        if (credentials) {
          connected = true;
          instagramUsername = credentials.instagramUsername;
        }
      }

      res.json({
        configured,
        connected,
        instagramUsername,
      });
    } catch (error) {
      console.error("Error checking Instagram status:", error);
      res.status(500).json({ error: "Failed to check Instagram status" });
    }
  });

  // Get OAuth authorization URL
  app.get("/api/instagram/auth-url", async (req, res) => {
    try {
      if (!isInstagramConfigured()) {
        return res.status(503).json({
          error: "Instagram integration not configured. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.",
        });
      }

      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Must be logged in to connect Instagram" });
      }

      // Generate state for CSRF protection
      const state = crypto.randomUUID();
      req.session.instagramOAuthState = state;

      // Build redirect URI
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const redirectUri = `${protocol}://${host}/api/instagram/callback`;

      const authUrl = getInstagramAuthUrl(redirectUri, state);

      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Instagram auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  // OAuth callback handler
  app.get("/api/instagram/callback", async (req, res) => {
    try {
      const { code, state, error: oauthError, error_description } = req.query;

      if (oauthError) {
        console.error("[Instagram] OAuth error:", oauthError, error_description);
        return res.redirect(`/account?error=${encodeURIComponent(String(error_description || oauthError))}`);
      }

      if (!code || typeof code !== "string") {
        return res.redirect("/account?error=No+authorization+code+received");
      }

      // Verify state
      if (state !== req.session.instagramOAuthState) {
        console.error("[Instagram] State mismatch:", state, req.session.instagramOAuthState);
        return res.redirect("/account?error=Invalid+state+parameter");
      }

      const userId = req.session.userId;
      if (!userId) {
        return res.redirect("/login?error=Session+expired");
      }

      // Build redirect URI (must match the one used to generate auth URL)
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const redirectUri = `${protocol}://${host}/api/instagram/callback`;

      // Exchange code for token
      const authResult = await exchangeCodeForToken(code, redirectUri);

      if (!authResult.success) {
        return res.redirect(`/account?error=${encodeURIComponent(authResult.error || "Authentication failed")}`);
      }

      // Save credentials to database
      const expiresAt = authResult.expiresIn
        ? new Date(Date.now() + authResult.expiresIn * 1000)
        : null;

      await storage.saveInstagramCredentials({
        userId,
        instagramUserId: authResult.instagramUserId!,
        instagramUsername: authResult.instagramUsername || null,
        accessToken: authResult.accessToken!,
        tokenExpiresAt: expiresAt,
      });

      console.log(`[Instagram] User ${userId} connected Instagram account @${authResult.instagramUsername}`);

      // Clear OAuth state
      delete req.session.instagramOAuthState;

      res.redirect("/account?success=Instagram+connected+successfully");
    } catch (error) {
      console.error("Error in Instagram callback:", error);
      res.redirect("/account?error=Connection+failed");
    }
  });

  // Disconnect Instagram
  app.post("/api/instagram/disconnect", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Must be logged in" });
      }

      const deleted = await storage.deleteInstagramCredentials(userId);

      if (deleted) {
        console.log(`[Instagram] User ${userId} disconnected Instagram account`);
        res.json({ success: true, message: "Instagram disconnected" });
      } else {
        res.json({ success: true, message: "No Instagram account was connected" });
      }
    } catch (error) {
      console.error("Error disconnecting Instagram:", error);
      res.status(500).json({ error: "Failed to disconnect Instagram" });
    }
  });

  // Publish a post to Instagram
  app.post("/api/posts/:id/publish-instagram", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Must be logged in" });
      }

      // Get Instagram credentials
      const credentials = await storage.getInstagramCredentials(userId);
      if (!credentials) {
        return res.status(400).json({
          error: "No Instagram account connected. Go to Account settings to connect.",
        });
      }

      // Check if token is expired
      if (credentials.tokenExpiresAt && new Date() > credentials.tokenExpiresAt) {
        return res.status(401).json({
          error: "Instagram token has expired. Please reconnect your account.",
        });
      }

      // Get the post (verify ownership)
      const post = await storage.getPost(req.params.id);
      if (!post || post.userId !== userId) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (!post.images || post.images.length === 0) {
        return res.status(400).json({ error: "Post must have at least one image" });
      }

      // Make sure image URLs are publicly accessible
      // For local uploads, we need to serve them via full URL
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const imageUrls = post.images.map((img) => {
        if (img.startsWith("/")) {
          return `${baseUrl}${img}`;
        }
        return img;
      });

      // Post to Instagram
      const result = await postToInstagram(
        credentials.accessToken,
        credentials.instagramUserId,
        imageUrls,
        post.content
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Update post status to "posted"
      await storage.updatePostStatus(post.id, "posted");

      // Mark photos as posted
      if (post.images && post.images.length > 0) {
        await storage.markPhotosAsPosted(post.images);
      }

      console.log(`[Instagram] Post ${post.id} published successfully: ${result.mediaId}`);

      res.json({
        success: true,
        message: "Post published to Instagram",
        mediaId: result.mediaId,
      });
    } catch (error) {
      console.error("Error publishing to Instagram:", error);
      res.status(500).json({ error: "Failed to publish to Instagram" });
    }
  });

  // Automatic scheduler - checks for due posts and sends them once (no retries)
  async function processDuePosts() {
    try {
      const settings = await storage.getPostingSettings();
      
      // Check if posting is paused
      if (settings.isPaused === "true") {
        return;
      }

      // Get due posts (scheduled time has passed)
      const duePosts = await storage.getDuePosts();
      
      if (duePosts.length === 0) {
        return;
      }

      // Process each due post once
      for (const post of duePosts) {
        if (!POSTING_WEBHOOK_URL) {
          console.log("No webhook URL configured. Moving post to posted:", post.id);
          await storage.updatePostStatus(post.id, "posted");
          // Mark any tagged photos used in this post as "posted"
          if (post.images && post.images.length > 0) {
            const markedCount = await storage.markPhotosAsPosted(post.images);
            console.log(`Marked ${markedCount} tagged photos as posted for post ${post.id}`);
          }
          continue;
        }

        console.log(`Sending post ${post.id} to webhook (single attempt)...`);
        
        try {
          // Send to n8n webhook
          const response = await fetch(POSTING_WEBHOOK_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              postId: post.id,
              caption: post.content,
              images: post.images || [],
              collaborators: post.collaborators || [],
              scheduledDate: post.scheduledDate,
            }),
          });

          // Move to posted regardless of response (single attempt, no retries)
          await storage.updatePostStatus(post.id, "posted");
          // Mark any tagged photos used in this post as "posted"
          if (post.images && post.images.length > 0) {
            const markedCount = await storage.markPhotosAsPosted(post.images);
            console.log(`Marked ${markedCount} tagged photos as posted for post ${post.id}`);
          }
          console.log(`Post ${post.id} sent to webhook and moved to 'posted' status`);
          
          // Recalculate dates
          await recalculateApprovedPostsDates();
        } catch (error) {
          // Even if webhook fails, move to posted to prevent retries
          console.error(`Failed to send post ${post.id} to webhook:`, error);
          await storage.updatePostStatus(post.id, "posted");
          // Mark any tagged photos used in this post as "posted"
          if (post.images && post.images.length > 0) {
            const markedCount = await storage.markPhotosAsPosted(post.images);
            console.log(`Marked ${markedCount} tagged photos as posted for post ${post.id}`);
          }
          await recalculateApprovedPostsDates();
        }
      }
    } catch (error) {
      console.error("Error processing due posts:", error);
    }
  }

  // Start scheduler - check every 60 seconds
  setInterval(processDuePosts, 60000);
  
  // Also run immediately on startup
  setTimeout(processDuePosts, 5000);
  
  console.log("Post scheduler started - checking every 60 seconds (single attempt per post)");

  return httpServer;
}
