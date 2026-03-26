CREATE TABLE "instagram_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"instagram_user_id" text NOT NULL,
	"instagram_username" text,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_batch_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"storage_path" text NOT NULL,
	"photo_url" text NOT NULL,
	"hash" text,
	"tags" text[],
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"folder_id" varchar,
	"status" text DEFAULT 'uploading' NOT NULL,
	"strictness" text DEFAULT 'medium' NOT NULL,
	"total_photos" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posting_settings" (
	"id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
	"is_paused" text DEFAULT 'false' NOT NULL,
	"webhook_url" text,
	"default_post_time" text DEFAULT '17:00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"images" text[],
	"collaborators" text[],
	"order" integer NOT NULL,
	"layout" text DEFAULT 'single' NOT NULL,
	"date_manually_set" boolean DEFAULT false NOT NULL,
	"publish_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "similar_group_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"batch_item_id" varchar NOT NULL,
	"distance" integer DEFAULT 0 NOT NULL,
	"is_selected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "similar_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "tagged_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"folder_id" varchar,
	"photo_id" text NOT NULL,
	"photo_url" text NOT NULL,
	"description" text,
	"tags" text[],
	"status" text DEFAULT 'available' NOT NULL,
	"posted_at" timestamp,
	"original_filename" text,
	"storage_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text DEFAULT 'free',
	"plan_tier" text DEFAULT 'free',
	"trial_ends_at" timestamp,
	"current_period_ends_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "instagram_credentials" ADD CONSTRAINT "instagram_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_batch_items" ADD CONSTRAINT "photo_batch_items_batch_id_photo_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."photo_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_batches" ADD CONSTRAINT "photo_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_batches" ADD CONSTRAINT "photo_batches_folder_id_photo_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."photo_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_folders" ADD CONSTRAINT "photo_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similar_group_items" ADD CONSTRAINT "similar_group_items_group_id_similar_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."similar_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similar_group_items" ADD CONSTRAINT "similar_group_items_batch_item_id_photo_batch_items_id_fk" FOREIGN KEY ("batch_item_id") REFERENCES "public"."photo_batch_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similar_groups" ADD CONSTRAINT "similar_groups_batch_id_photo_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."photo_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tagged_photos" ADD CONSTRAINT "tagged_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tagged_photos" ADD CONSTRAINT "tagged_photos_folder_id_photo_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."photo_folders"("id") ON DELETE no action ON UPDATE no action;