/**
 * Instagram Graph API Integration
 *
 * This module handles Instagram OAuth authentication and posting
 * via the Instagram Graph API (for Business/Creator accounts).
 */

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || "";
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || "";

// Instagram Graph API base URL
const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

export interface InstagramAuthResult {
  success: boolean;
  accessToken?: string;
  instagramUserId?: string;
  instagramUsername?: string;
  expiresIn?: number;
  error?: string;
}

export interface InstagramPostResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}

/**
 * Check if Instagram integration is configured
 */
export function isInstagramConfigured(): boolean {
  return Boolean(INSTAGRAM_APP_ID && INSTAGRAM_APP_SECRET);
}

/**
 * Generate OAuth authorization URL for Instagram
 * Users will be redirected to this URL to grant access
 */
export function getInstagramAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: redirectUri,
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    response_type: "code",
    state,
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<InstagramAuthResult> {
  try {
    // Step 1: Exchange code for short-lived token
    const tokenResponse = await fetch(`${GRAPH_API_BASE}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error("[Instagram] Token exchange failed:", error);
      return {
        success: false,
        error: error.error?.message || "Failed to exchange code for token",
      };
    }

    const tokenData = await tokenResponse.json();
    const shortLivedToken = tokenData.access_token;

    // Step 2: Exchange short-lived token for long-lived token
    const longLivedResponse = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: INSTAGRAM_APP_ID,
          client_secret: INSTAGRAM_APP_SECRET,
          fb_exchange_token: shortLivedToken,
        })
    );

    if (!longLivedResponse.ok) {
      const error = await longLivedResponse.json();
      console.error("[Instagram] Long-lived token exchange failed:", error);
      return {
        success: false,
        error: error.error?.message || "Failed to get long-lived token",
      };
    }

    const longLivedData = await longLivedResponse.json();
    const accessToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in || 5184000; // ~60 days default

    // Step 3: Get the user's Instagram Business Account ID
    // First, get the Facebook Pages the user manages
    const pagesResponse = await fetch(
      `${GRAPH_API_BASE}/me/accounts?access_token=${accessToken}`
    );

    if (!pagesResponse.ok) {
      const error = await pagesResponse.json();
      console.error("[Instagram] Failed to get pages:", error);
      return {
        success: false,
        error: "Failed to get Facebook Pages. Make sure you have a Business account.",
      };
    }

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      return {
        success: false,
        error: "No Facebook Pages found. You need a Facebook Page connected to an Instagram Business account.",
      };
    }

    // Get the first page's Instagram Business Account
    const pageId = pages[0].id;
    const pageAccessToken = pages[0].access_token;

    const igAccountResponse = await fetch(
      `${GRAPH_API_BASE}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
    );

    if (!igAccountResponse.ok) {
      const error = await igAccountResponse.json();
      console.error("[Instagram] Failed to get IG business account:", error);
      return {
        success: false,
        error: "Failed to get Instagram Business Account",
      };
    }

    const igAccountData = await igAccountResponse.json();
    const instagramBusinessAccount = igAccountData.instagram_business_account;

    if (!instagramBusinessAccount) {
      return {
        success: false,
        error: "No Instagram Business Account found. Make sure your Instagram account is connected to your Facebook Page as a Business or Creator account.",
      };
    }

    const instagramUserId = instagramBusinessAccount.id;

    // Step 4: Get Instagram username
    const igUserResponse = await fetch(
      `${GRAPH_API_BASE}/${instagramUserId}?fields=username&access_token=${pageAccessToken}`
    );

    let instagramUsername = "";
    if (igUserResponse.ok) {
      const igUserData = await igUserResponse.json();
      instagramUsername = igUserData.username || "";
    }

    console.log(`[Instagram] Successfully authenticated: @${instagramUsername} (${instagramUserId})`);

    return {
      success: true,
      accessToken: pageAccessToken, // Use page access token for posting
      instagramUserId,
      instagramUsername,
      expiresIn,
    };
  } catch (error) {
    console.error("[Instagram] Auth error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown authentication error",
    };
  }
}

/**
 * Post a single image to Instagram
 */
export async function postSingleImage(
  accessToken: string,
  instagramUserId: string,
  imageUrl: string,
  caption: string
): Promise<InstagramPostResult> {
  try {
    // Step 1: Create media container
    const containerResponse = await fetch(
      `${GRAPH_API_BASE}/${instagramUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        }),
      }
    );

    if (!containerResponse.ok) {
      const error = await containerResponse.json();
      console.error("[Instagram] Failed to create media container:", error);
      return {
        success: false,
        error: error.error?.message || "Failed to create media container",
      };
    }

    const containerData = await containerResponse.json();
    const containerId = containerData.id;

    // Step 2: Publish the container
    const publishResponse = await fetch(
      `${GRAPH_API_BASE}/${instagramUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      console.error("[Instagram] Failed to publish media:", error);
      return {
        success: false,
        error: error.error?.message || "Failed to publish media",
      };
    }

    const publishData = await publishResponse.json();
    console.log(`[Instagram] Successfully posted single image: ${publishData.id}`);

    return {
      success: true,
      mediaId: publishData.id,
    };
  } catch (error) {
    console.error("[Instagram] Post single image error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown posting error",
    };
  }
}

/**
 * Post a carousel (multiple images) to Instagram
 */
export async function postCarousel(
  accessToken: string,
  instagramUserId: string,
  imageUrls: string[],
  caption: string
): Promise<InstagramPostResult> {
  try {
    if (imageUrls.length < 2 || imageUrls.length > 10) {
      return {
        success: false,
        error: "Carousel must have between 2 and 10 images",
      };
    }

    // Step 1: Create media containers for each image
    const containerIds: string[] = [];

    for (const imageUrl of imageUrls) {
      const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${instagramUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        }
      );

      if (!containerResponse.ok) {
        const error = await containerResponse.json();
        console.error("[Instagram] Failed to create carousel item container:", error);
        return {
          success: false,
          error: error.error?.message || "Failed to create carousel item",
        };
      }

      const containerData = await containerResponse.json();
      containerIds.push(containerData.id);
    }

    // Step 2: Create carousel container
    const carouselResponse = await fetch(
      `${GRAPH_API_BASE}/${instagramUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: containerIds.join(","),
          caption,
          access_token: accessToken,
        }),
      }
    );

    if (!carouselResponse.ok) {
      const error = await carouselResponse.json();
      console.error("[Instagram] Failed to create carousel container:", error);
      return {
        success: false,
        error: error.error?.message || "Failed to create carousel container",
      };
    }

    const carouselData = await carouselResponse.json();
    const carouselContainerId = carouselData.id;

    // Step 3: Publish the carousel
    const publishResponse = await fetch(
      `${GRAPH_API_BASE}/${instagramUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: carouselContainerId,
          access_token: accessToken,
        }),
      }
    );

    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      console.error("[Instagram] Failed to publish carousel:", error);
      return {
        success: false,
        error: error.error?.message || "Failed to publish carousel",
      };
    }

    const publishData = await publishResponse.json();
    console.log(`[Instagram] Successfully posted carousel with ${imageUrls.length} images: ${publishData.id}`);

    return {
      success: true,
      mediaId: publishData.id,
    };
  } catch (error) {
    console.error("[Instagram] Post carousel error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown posting error",
    };
  }
}

/**
 * Post to Instagram (automatically chooses single image or carousel)
 */
export async function postToInstagram(
  accessToken: string,
  instagramUserId: string,
  imageUrls: string[],
  caption: string
): Promise<InstagramPostResult> {
  if (imageUrls.length === 0) {
    return {
      success: false,
      error: "At least one image is required",
    };
  }

  if (imageUrls.length === 1) {
    return postSingleImage(accessToken, instagramUserId, imageUrls[0], caption);
  }

  return postCarousel(accessToken, instagramUserId, imageUrls, caption);
}
