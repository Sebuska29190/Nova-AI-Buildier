/**
 * Social Media Tools — manage accounts, post, upload video
 *
 * Uses browser automation with persistent profiles.
 * Login once through the browser → cookies saved → no re-login needed.
 */

import { listAccounts, addAccount, removeAccount, getAccount, updateAccount } from "./manager.ts";

export const socialTools = {
  social_list_accounts: {
    name: "social_list_accounts",
    description: "List all connected social media accounts (TikTok, Instagram, YouTube, etc.).",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      const accounts = listAccounts();
      if (accounts.length === 0) return "📭 No social accounts connected yet. Use social_add_account to add one.";
      return accounts.map((a, i) =>
        `${i + 1}. **${a.name}** (${a.platform})${a.username ? ` — @${a.username}` : ""}`
      ).join("\n");
    },
  },

  social_add_account: {
    name: "social_add_account",
    description: "Add a new social media account. Opens browser for login — you log in once, Nova saves the session.",
    parameters: {
      type: "object", properties: {
        platform: { type: "string", description: "Platform name: tiktok, instagram, youtube, linkedin, facebook, reddit, threads, pinterest" },
        name: { type: "string", description: "A friendly label (e.g. 'My TikTok')" },
      }, required: ["platform", "name"], additionalProperties: false,
    },
    async execute(args: { platform: string; name: string }) {
      const account = addAccount({ name: args.name, platform: args.platform.toLowerCase() });

      const loginUrls: Record<string, string> = {
        tiktok: "https://www.tiktok.com/login",
        instagram: "https://www.instagram.com/accounts/login/",
        youtube: "https://accounts.google.com/ServiceLogin?service=youtube",
        linkedin: "https://www.linkedin.com/login",
        facebook: "https://www.facebook.com/login",
        reddit: "https://www.reddit.com/login",
        threads: "https://www.threads.net/login",
        pinterest: "https://www.pinterest.com/login",
      };

      const loginUrl = loginUrls[args.platform.toLowerCase()] || `https://www.${args.platform}.com/login`;

      return `✅ Account **${args.name}** created (ID: ${account.id})

To complete setup, I need to open the browser so you can log in:

1. I'll launch the browser with your saved profile
2. Navigate to ${loginUrl}
3. You log in manually (once!)
4. After login, tell me "done" and I'll save the session

**Launch browser now?** Just say "yes, launch browser for ${args.name}"`;
    },
  },

  social_post: {
    name: "social_post",
    description: "Post text/image to a connected social media account. Uses API for Bluesky/X, browser automation for others.",
    parameters: {
      type: "object", properties: {
        accountId: { type: "string", description: "Account ID from social_list_accounts" },
        text: { type: "string", description: "Post content / caption" },
        mediaPath: { type: "string", description: "Optional path to image/video file" },
      }, required: ["accountId", "text"], additionalProperties: false,
    },
    async execute(args: { accountId: string; text: string; mediaPath?: string }) {
      const account = getAccount(args.accountId);
      if (!account) throw new Error(`Account '${args.accountId}' not found. Use social_list_accounts to see available accounts.`);

      // API-based posting for Bluesky
      if (account.platform === "bluesky" && account.authMethod === "api_key") {
        try {
          const { postToBluesky } = await import("./platforms/bluesky.ts");
          const result = await postToBluesky(account.apiConfig, args.text, args.mediaPath);
          return `✅ Posted to Bluesky: ${result}`;
        } catch (e: any) {
          return `❌ Bluesky post failed: ${e.message}`;
        }
      }

      // API-based posting for Twitter/X
      if ((account.platform === "twitter" || account.platform === "x") && account.authMethod === "api_key") {
        try {
          const { postToTwitter } = await import("./platforms/twitter.ts");
          const result = await postToTwitter(account.apiConfig, args.text);
          return `✅ Posted to X/Twitter: ${result}`;
        } catch (e: any) {
          return `❌ Twitter post failed: ${e.message}`;
        }
      }

      // Browser-based posting for other platforms
      const postUrl = fetchPostUrl(account.platform);
      const steps = [
        `1. Launch browser with profile: ${account.profileDir}`,
        `2. Navigate to: ${postUrl}`,
        `3. ${args.mediaPath ? `Upload: ${args.mediaPath}` : "Type text"}`,
        `4. Click post button`,
        `5. Close browser`,
      ];

      return `🤖 Browser posting to **${account.name}** (${account.platform}):\n\n${steps.join("\n")}\n\nSay "execute post to ${account.name}" to run.`;
    },
  },

  social_upload_video: {
    name: "social_upload_video",
    description: "Upload a video to a connected social media account (TikTok, YouTube, Instagram, etc.). Opens browser, uploads, and posts.",
    parameters: {
      type: "object", properties: {
        accountId: { type: "string", description: "Account ID from social_list_accounts" },
        videoPath: { type: "string", description: "Absolute path to the video file (MP4)" },
        description: { type: "string", description: "Video description / caption" },
        title: { type: "string", description: "Video title (YouTube, LinkedIn only)" },
      }, required: ["accountId", "videoPath", "description"], additionalProperties: false,
    },
    async execute(args: { accountId: string; videoPath: string; description: string; title?: string }) {
      const account = getAccount(args.accountId);
      if (!account) throw new Error(`Account '${args.accountId}' not found.`);

      const fs = await import("node:fs");
      if (!fs.existsSync(args.videoPath)) throw new Error(`Video file not found: ${args.videoPath}`);

      const platform = account.platform;
      let navigateUrl: string;
      let fileSelector = "input[type=file]";
      let descSelector = "div[contenteditable=true]";
      let submitSelector = "button[type=submit]";

      if (platform === "tiktok") {
        navigateUrl = "https://www.tiktok.com/upload";
      } else if (platform === "youtube") {
        navigateUrl = "https://studio.youtube.com";
        submitSelector = "ytcp-button#create-icon,#create-icon";
        descSelector = "#description-textarea";
      } else if (platform === "instagram") {
        navigateUrl = "https://www.instagram.com";
      } else if (platform === "linkedin") {
        navigateUrl = "https://www.linkedin.com/post/new";
      } else {
        navigateUrl = `https://www.${platform}.com`;
      }

      return `🤖 **Video upload to ${account.name}** (${platform})

File: ${args.videoPath}
Description: ${args.description.slice(0, 80)}...

**Browser automation plan:**
1. Launch browser (saved session for ${account.name})
2. Navigate to ${navigateUrl}
3. Click upload/file button
4. Select video file: ${args.videoPath}
5. Wait for upload to process (~5-30s depending on video size)
6. Fill description
7. Click post/submit
8. Close browser

**To execute, say:** "upload video to ${account.name}"`;
    },
  },

  social_remove_account: {
    name: "social_remove_account",
    description: "Remove a connected social media account and delete its saved session.",
    parameters: {
      type: "object", properties: {
        accountId: { type: "string", description: "Account ID from social_list_accounts" },
      }, required: ["accountId"], additionalProperties: false,
    },
    async execute(args: { accountId: string }) {
      const ok = removeAccount(args.accountId);
      return ok ? `🗑️ Account removed` : `❌ Account not found`;
    },
  },
};

// ── Platform-specific helpers ────────────────────────────
function fetchPostUrl(platform: string): { url: string } {
  const urls: Record<string, string> = {
    tiktok: "https://www.tiktok.com/upload",
    instagram: "https://www.instagram.com",
    youtube: "https://studio.youtube.com",
    linkedin: "https://www.linkedin.com/feed/",
    facebook: "https://www.facebook.com",
    reddit: "https://www.reddit.com/submit",
    threads: "https://www.threads.net",
    pinterest: "https://www.pinterest.com/pin-builder/",
  };
  return { url: urls[platform] || `https://www.${platform}.com` };
}

function postTextSelector(platform: string): string {
  const map: Record<string, string> = {
    tiktok: "div[contenteditable=true]",
    instagram: "div[role=textbox]",
    youtube: "#description-textarea",
    linkedin: "div[role=textbox]",
    facebook: "div[role=textbox]",
    reddit: "textarea[name=title],div[role=textbox]",
    threads: "div[role=textbox]",
    pinterest: "textarea",
  };
  return map[platform] || "div[contenteditable=true]";
}

function postButtonSelector(platform: string): string {
  const map: Record<string, string> = {
    tiktok: "button[type=submit]",
    instagram: "div[role=button]:has(div:contains('Share'))",
    youtube: "#create-icon-button",
    linkedin: "button[type=submit]",
    facebook: "div[role=button]:has(span:contains('Post'))",
    reddit: "button[type=submit]",
    threads: "button[type=submit]",
    pinterest: "button[type=submit]",
  };
  return map[platform] || "button[type=submit]";
}
