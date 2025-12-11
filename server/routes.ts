import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPostSchema, updatePostSchema, postStatusEnum, reorderSchema, insertTaggedPhotoSchema, updateTaggedPhotoSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all posts
  app.get("/api/posts", async (_req, res) => {
    try {
      const posts = await storage.getAllPosts();
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  // Reorder posts - MUST be before /api/posts/:id to avoid matching "reorder" as an id
  app.put("/api/posts/reorder", async (req, res) => {
    try {
      const validatedData = reorderSchema.parse(req.body);
      await storage.reorderPosts(validatedData.updates);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error reordering posts:", error);
      res.status(500).json({ error: "Failed to reorder posts" });
    }
  });

  // Get single post
  app.get("/api/posts/:id", async (req, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      console.error("Error fetching post:", error);
      res.status(500).json({ error: "Failed to fetch post" });
    }
  });

  // Create post
  app.post("/api/posts", async (req, res) => {
    try {
      const validatedData = insertPostSchema.parse(req.body);
      const post = await storage.createPost(validatedData);
      res.status(201).json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // Update post (content, images, scheduledDate)
  app.put("/api/posts/:id", async (req, res) => {
    try {
      const validatedData = updatePostSchema.parse(req.body);
      const post = await storage.updatePost(req.params.id, validatedData);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating post:", error);
      res.status(500).json({ error: "Failed to update post" });
    }
  });

  // Update post status (approve/reject)
  app.patch("/api/posts/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const validatedStatus = postStatusEnum.parse(status);
      const post = await storage.updatePostStatus(req.params.id, validatedStatus);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid status. Must be pending, approved, rejected, or draft" });
      }
      console.error("Error updating post status:", error);
      res.status(500).json({ error: "Failed to update post status" });
    }
  });

  // Delete post
  app.delete("/api/posts/:id", async (req, res) => {
    try {
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

  // Seed initial data if database is empty
  app.post("/api/seed", async (_req, res) => {
    try {
      const existingPosts = await storage.getAllPosts();
      if (existingPosts.length > 0) {
        return res.json({ message: "Database already has data", count: existingPosts.length });
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
        await storage.createPost(post);
      }

      res.json({ message: "Database seeded successfully", count: seedPosts.length });
    } catch (error) {
      console.error("Error seeding database:", error);
      res.status(500).json({ error: "Failed to seed database" });
    }
  });

  // Webhook endpoint for n8n to create posts
  app.post("/api/webhook/posts", async (req, res) => {
    try {
      console.log("Webhook received:", JSON.stringify(req.body, null, 2));
      
      // Handle both single object and array format from n8n
      const data = Array.isArray(req.body) ? req.body[0] : req.body;
      
      if (!data) {
        return res.status(400).json({ error: "No data provided" });
      }
      
      const { status, caption, Status, Caption } = data;
      
      // Use either camelCase or original casing from n8n
      const postStatus = status || Status;
      const postCaption = caption || Caption;
      
      if (!postCaption) {
        return res.status(400).json({ error: "Caption is required" });
      }
      
      // Collect all images from Image 1 through Image 10
      const images: string[] = [];
      for (let i = 1; i <= 10; i++) {
        const imageKey = `Image ${i}`;
        const imageUrl = data[imageKey];
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
          images.push(imageUrl.trim());
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
      
      // Get the max order for pending posts to add new post at the end
      const allPosts = await storage.getAllPosts();
      const pendingPosts = allPosts.filter(p => p.status === "pending");
      const maxOrder = pendingPosts.length > 0 
        ? Math.max(...pendingPosts.map(p => p.order || 0)) 
        : 0;
      
      // Calculate scheduled date based on position (tomorrow + order at 5:00 PM)
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1 + maxOrder);
      scheduledDate.setHours(17, 0, 0, 0);
      
      // Create the post
      const post = await storage.createPost({
        content: postCaption,
        status: mappedStatus,
        images: images.length > 0 ? images : null,
        order: maxOrder + 1,
        scheduledDate,
      });
      
      console.log("Post created via webhook:", post.id);
      res.status(201).json({ success: true, postId: post.id, message: "Post created successfully" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Tagged Photos routes
  app.get("/api/tagged-photos", async (_req, res) => {
    try {
      const photos = await storage.getAllTaggedPhotos();
      res.json(photos);
    } catch (error) {
      console.error("Error fetching tagged photos:", error);
      res.status(500).json({ error: "Failed to fetch tagged photos" });
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
      const validatedData = updateTaggedPhotoSchema.parse(req.body);
      const photo = await storage.updateTaggedPhoto(req.params.id, validatedData);
      if (!photo) {
        return res.status(404).json({ error: "Photo not found" });
      }
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
      const deleted = await storage.deleteTaggedPhoto(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ error: "Failed to delete photo" });
    }
  });

  return httpServer;
}
