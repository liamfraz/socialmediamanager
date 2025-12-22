import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPostSchema, updatePostSchema, postStatusEnum, reorderSchema, insertTaggedPhotoSchema, updateTaggedPhotoSchema } from "@shared/schema";
import { z } from "zod";

// Webhook URL from environment
const POSTING_WEBHOOK_URL = process.env.N8N_POSTING_WEBHOOK_URL || "";

// Track scheduler interval
let schedulerInterval: NodeJS.Timeout | null = null;

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

  // Helper function to recalculate scheduled dates for all approved posts
  async function recalculateApprovedPostsDates() {
    const allPosts = await storage.getAllPosts();
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
      const validatedData = reorderSchema.parse(req.body);
      await storage.reorderPosts(validatedData.updates);
      // Recalculate dates after reordering
      await recalculateApprovedPostsDates();
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
      
      // Recalculate all approved posts dates after status change
      if (validatedStatus === "approved" || validatedStatus === "rejected" || validatedStatus === "pending") {
        await recalculateApprovedPostsDates();
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

  // Trigger n8n webhook to generate posts
  app.post("/api/trigger-generate", async (req, res) => {
    try {
      const { topic } = req.body;
      const n8nWebhookUrl = "https://liamfraz3.app.n8n.cloud/webhook/0d25b57d-4af4-4526-8bfe-2d89247c713f";
      
      const response = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: topic || "general content" }),
      });
      
      console.log("n8n webhook triggered, status:", response.status);
      res.json({ success: true, message: "Generation triggered" });
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
        // First pass: collect all imageUrl values and extract caption/status
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
        
        const { status, caption, Status, Caption } = data;
        postStatus = status || Status || postStatus || "";
        if (!postCaption) {
          postCaption = caption || Caption || "";
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
      
      // Get all pending posts and shift their order to make room at the top
      const allPosts = await storage.getAllPosts();
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
      });
      
      console.log("Post created via webhook:", post.id);
      res.status(201).json({ success: true, postId: post.id, message: "Post created successfully" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
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
      // Expected format: { Image, filename, url, tags, uploadDate }
      const { filename, url, tags, uploadDate, Image } = data;
      
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
      
      // Create the tagged photo
      const photo = await storage.createTaggedPhoto({
        photoId,
        photoUrl: displayableUrl,
        description: filename || null,
        tags: parsedTags.length > 0 ? parsedTags : null,
      });
      
      console.log("Tagged photo created via webhook:", photo.id);
      res.status(201).json({ success: true, photoId: photo.id, message: "Tagged photo created successfully" });
    } catch (error) {
      console.error("Tagged photos webhook error:", error);
      res.status(500).json({ error: "Failed to process tagged photos webhook" });
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

  // Recalculate dates endpoint (for initial setup)
  app.post("/api/posts/recalculate-dates", async (_req, res) => {
    try {
      await recalculateApprovedPostsDates();
      res.json({ success: true, message: "Dates recalculated" });
    } catch (error) {
      console.error("Error recalculating dates:", error);
      res.status(500).json({ error: "Failed to recalculate dates" });
    }
  });

  // Manual post endpoint - sends a post to webhook immediately
  app.post("/api/posts/:id/post-now", async (req, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (!POSTING_WEBHOOK_URL) {
        return res.status(400).json({ error: "No webhook URL configured" });
      }

      console.log(`Manual posting: Sending post ${post.id} to webhook...`);
      
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
          scheduledDate: post.scheduledDate,
          manualPost: true,
        }),
      });

      if (response.ok) {
        // Wait for verification - REQUIRE explicit confirmation from n8n
        let verified = false;
        let responseMessage = "";
        try {
          const responseData = await response.json();
          console.log(`Webhook response for post ${post.id}:`, JSON.stringify(responseData));
          // Only accept explicit success confirmation - NOT just 200 OK
          verified = responseData.success === true || 
                    responseData.verified === true ||
                    responseData.status === "success" ||
                    responseData.status === "posted";
          responseMessage = responseData.message || "";
        } catch (parseError) {
          // No JSON response means no explicit confirmation
          console.log(`No JSON response from webhook for post ${post.id}. Treating as unconfirmed.`);
          verified = false;
        }

        if (verified) {
          // Move post to "posted" status only after n8n confirms
          await storage.updatePostStatus(post.id, "posted");
          // Recalculate remaining approved posts dates
          await recalculateApprovedPostsDates();
          console.log(`Manual post ${post.id} verified by n8n and moved to 'posted' status`);
          res.json({ success: true, message: responseMessage || "Post sent and confirmed" });
        } else {
          console.log(`Manual post ${post.id} sent but not confirmed by n8n. Response did not contain success confirmation.`);
          res.status(400).json({ error: "Post sent but not confirmed. Configure your n8n workflow to use 'Respond to Webhook' node and return { success: true } after posting." });
        }
      } else {
        console.error(`Failed to manually send post ${post.id} to webhook:`, response.status);
        res.status(500).json({ error: `Webhook returned ${response.status}` });
      }
    } catch (error) {
      console.error("Error manually posting:", error);
      res.status(500).json({ error: "Failed to send post" });
    }
  });

  // Function to process due posts
  async function processDuePosts() {
    try {
      const settings = await storage.getPostingSettings();
      
      // Check if posting is paused
      if (settings.isPaused === "true") {
        // Move all due posts to next day at 5pm Melbourne (6am UTC)
        const duePosts = await storage.getDuePosts();
        for (const post of duePosts) {
          const nextDay = new Date();
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          nextDay.setUTCHours(6, 0, 0, 0); // 5pm Melbourne = 6am UTC
          await storage.updatePost(post.id, { scheduledDate: nextDay });
        }
        // Recalculate all dates to maintain sequence
        await recalculateApprovedPostsDates();
        console.log(`Posting paused. Moved ${duePosts.length} posts to next day.`);
        return;
      }

      // Get due posts
      const duePosts = await storage.getDuePosts();
      
      if (duePosts.length === 0) {
        return;
      }

      // Process first due post only (one at a time)
      const post = duePosts[0];
      
      if (!POSTING_WEBHOOK_URL) {
        console.log("No webhook URL configured. Skipping post:", post.id);
        return;
      }

      console.log(`Sending post ${post.id} to webhook...`);
      
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
          scheduledDate: post.scheduledDate,
        }),
      });

      if (response.ok) {
        // Wait for verification - REQUIRE explicit confirmation from n8n
        let verified = false;
        try {
          const responseData = await response.json();
          console.log(`Scheduler webhook response for post ${post.id}:`, JSON.stringify(responseData));
          // Only accept explicit success confirmation - NOT just 200 OK
          verified = responseData.success === true || 
                    responseData.verified === true ||
                    responseData.status === "success" ||
                    responseData.status === "posted";
        } catch {
          // No JSON response means no explicit confirmation
          console.log(`No JSON response from webhook for scheduled post ${post.id}. Treating as unconfirmed.`);
          verified = false;
        }

        if (verified) {
          // Move post to "posted" status only after n8n confirms
          await storage.updatePostStatus(post.id, "posted");
          // Recalculate remaining approved posts dates
          await recalculateApprovedPostsDates();
          console.log(`Post ${post.id} confirmed by n8n and moved to 'posted' status`);
        } else {
          console.log(`Post ${post.id} sent but not confirmed by n8n. Keeping as approved for retry.`);
        }
      } else {
        console.error(`Failed to send post ${post.id} to webhook:`, response.status);
      }
    } catch (error) {
      console.error("Error processing due posts:", error);
    }
  }

  // Start scheduler - check every 30 seconds
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  schedulerInterval = setInterval(processDuePosts, 30000);
  
  // Also run immediately on startup
  setTimeout(processDuePosts, 5000);
  
  console.log("Post scheduler started - checking every 30 seconds");

  return httpServer;
}
