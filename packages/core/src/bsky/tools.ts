/**
 * Bluesky (AT Protocol) Tools — post, like, repost, timeline, search
 *
 * API: Free, no rate limits for normal usage
 * Auth: App Password (Settings → App Passwords)
 * Docs: https://docs.bsky.app/docs/category/http-reference
 */

const BSKY_HOST = "https://bsky.social/xrpc";

interface BskySession {
  accessJwt: string;
  refreshJwt: string;
  did: string;
  handle: string;
}

let _session: BskySession | null = null;
let _loggingIn = false;

// Auto-login from environment variables (BSKY_IDENTIFIER, BSKY_APP_PASSWORD)
async function ensureSession(): Promise<void> {
  if (_session) return;
  if (_loggingIn) return; // Prevent re-entrant calls
  _loggingIn = true;
  try {
    const id = process.env.BSKY_IDENTIFIER;
    const pw = process.env.BSKY_APP_PASSWORD;
    if (!id || !pw) throw new Error("Not logged in. Set BSKY_IDENTIFIER and BSKY_APP_PASSWORD in .env, or call bsky_login.");
    const data = await bskyFetch("com.atproto.server.createSession", { identifier: id, password: pw });
    _session = { accessJwt: data.accessJwt, refreshJwt: data.refreshJwt, did: data.did, handle: data.handle };
  } finally {
    _loggingIn = false;
  }
}

function getAuth(): string {
  return _session?.accessJwt ? `Bearer ${_session.accessJwt}` : "";
}

async function bskyFetch(action: string, body?: unknown): Promise<any> {
  const url = `${BSKY_HOST}/${action}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!_session && !_loggingIn) await ensureSession();
  if (_session) headers["Authorization"] = `Bearer ${_session.accessJwt}`;

  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Bluesky ${action}: ${data.error || res.status} — ${data.message || ""}`);
  return data;
}

export const bskyTools = {
  bsky_login: {
    name: "bsky_login",
    description: "Log in to Bluesky with identifier and app password. Call this first before other Bluesky tools.",
    parameters: {
      type: "object", properties: {
        identifier: { type: "string", description: "Your Bluesky handle (e.g. user.bsky.social). Leave empty to use BSKY_IDENTIFIER from .env" },
        password: { type: "string", description: "App password. Leave empty to use BSKY_APP_PASSWORD from .env" },
      }, additionalProperties: false,
    },
    async execute(args: { identifier?: string; password?: string }) {
      const id = args.identifier || process.env.BSKY_IDENTIFIER || "";
      const pw = args.password || process.env.BSKY_APP_PASSWORD || "";
      if (!id || !pw) throw new Error("No credentials. Provide identifier+password or set BSKY_IDENTIFIER and BSKY_APP_PASSWORD in .env");
      const data = await bskyFetch("com.atproto.server.createSession", {
        identifier: id, password: pw,
      });
      _session = { accessJwt: data.accessJwt, refreshJwt: data.refreshJwt, did: data.did, handle: data.handle };
      return `✅ Logged in as @${data.handle} (DID: ${data.did})`;
    },
  },

  bsky_post: {
    name: "bsky_post",
    description: "Post a new message (skeet) to Bluesky. Max ~300 chars per post.",
    parameters: {
      type: "object", properties: {
        text: { type: "string", description: "Post content (plain text, max 300 chars)" },
        lang: { type: "string", description: "Language code (e.g. pl, en). Default: pl" },
      }, required: ["text"], additionalProperties: false,
    },
    async execute(args: { text: string; lang?: string }) {
      await ensureSession();
      const data = await bskyFetch("com.atproto.repo.createRecord", {
        repo: _session.did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text: args.text.slice(0, 300),
          createdAt: new Date().toISOString(),
          langs: [args.lang || "pl"],
        },
      });
      return `✅ Posted: https://bsky.app/profile/${_session.handle}/post/${data.uri.split("/").pop()}`;
    },
  },

  bsky_like: {
    name: "bsky_like",
    description: "Like a post on Bluesky.",
    parameters: {
      type: "object", properties: {
        uri: { type: "string", description: "AT URI of the post to like (e.g. at://did:plc:xxx/app.bsky.feed.post/yyy)" },
        cid: { type: "string", description: "CID of the post (from search/timeline results)" },
      }, required: ["uri", "cid"], additionalProperties: false,
    },
    async execute(args: { uri: string; cid: string }) {
      await ensureSession();
      await bskyFetch("com.atproto.repo.createRecord", {
        repo: _session.did,
        collection: "app.bsky.feed.like",
        record: {
          $type: "app.bsky.feed.like",
          subject: { uri: args.uri, cid: args.cid },
          createdAt: new Date().toISOString(),
        },
      });
      return "❤️ Liked!";
    },
  },

  bsky_repost: {
    name: "bsky_repost",
    description: "Repost (share) a post on Bluesky.",
    parameters: {
      type: "object", properties: {
        uri: { type: "string", description: "AT URI of the post to repost" },
        cid: { type: "string", description: "CID of the post" },
      }, required: ["uri", "cid"], additionalProperties: false,
    },
    async execute(args: { uri: string; cid: string }) {
      await ensureSession();
      await bskyFetch("com.atproto.repo.createRecord", {
        repo: _session.did,
        collection: "app.bsky.feed.repost",
        record: {
          $type: "app.bsky.feed.repost",
          subject: { uri: args.uri, cid: args.cid },
          createdAt: new Date().toISOString(),
        },
      });
      return "🔁 Reposted!";
    },
  },

  bsky_timeline: {
    name: "bsky_timeline",
    description: "Fetch your Bluesky home timeline (latest posts from people you follow).",
    parameters: {
      type: "object", properties: {
        limit: { type: "number", description: "Number of posts to fetch (max 50). Default: 20" },
      }, additionalProperties: false,
    },
    async execute(args: { limit?: number }) {
      await ensureSession();
      const data = await bskyFetch(`app.bsky.feed.getTimeline?limit=${args.limit || 20}`);
      const posts = (data.feed || []).map((item: any) => {
        const p = item.post;
        const author = p.author?.displayName || p.author?.handle || "unknown";
        const time = new Date(p.record?.createdAt || 0).toLocaleString("pl-PL");
        return `  @${p.author?.handle} (${author}): ${(p.record?.text || "").slice(0, 100)}`;
      }).join("\n");
      return `📋 Timeline (${posts.length}):\n${posts}`;
    },
  },

  bsky_search: {
    name: "bsky_search",
    description: "Search posts on Bluesky by keyword.",
    parameters: {
      type: "object", properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results. Default: 10" },
      }, required: ["query"], additionalProperties: false,
    },
    async execute(args: { query: string; limit?: number }) {
      const data = await bskyFetch(`app.bsky.feed.searchPosts?q=${encodeURIComponent(args.query)}&limit=${args.limit || 10}`);
      const posts = (data.posts || []).map((p: any) => {
        const author = p.author?.displayName || p.author?.handle || "unknown";
        const uri = p.uri;
        const cid = p.cid;
        const time = new Date(p.record?.createdAt || 0).toLocaleString("pl-PL");
        return `  @${p.author?.handle} | ${(p.record?.text || "").slice(0, 120)} | URI: ${uri}`;
      }).join("\n");
      return `🔍 Results for "${args.query}":\n${posts}`;
    },
  },

  bsky_follow: {
    name: "bsky_follow",
    description: "Follow a user on Bluesky by their DID.",
    parameters: {
      type: "object", properties: {
        did: { type: "string", description: "DID of the user to follow (e.g. did:plc:xxx)" },
      }, required: ["did"], additionalProperties: false,
    },
    async execute(args: { did: string }) {
      await ensureSession();
      await bskyFetch("com.atproto.repo.createRecord", {
        repo: _session.did,
        collection: "app.bsky.graph.follow",
        record: {
          $type: "app.bsky.graph.follow",
          subject: args.did,
          createdAt: new Date().toISOString(),
        },
      });
      return `➕ Followed ${args.did}`;
    },
  },

  bsky_profile: {
    name: "bsky_profile",
    description: "Get your own Bluesky profile info (followers, follows, posts count).",
    parameters: {
      type: "object", properties: {}, additionalProperties: false,
    },
    async execute() {
      await ensureSession();
      const data = await bskyFetch(`app.bsky.actor.getProfile?actor=${_session.handle}`);
      return `👤 @${data.handle} (${data.displayName || "no display name"})
📝 Bio: ${data.description || "(none)"}
👥 Followers: ${data.followersCount || 0} | Following: ${data.followsCount || 0}
📬 Posts: ${data.postsCount || 0}`;
    },
  },

  bsky_my_posts: {
    name: "bsky_my_posts",
    description: "List your own recent Bluesky posts with URIs (needed for delete).",
    parameters: {
      type: "object", properties: {
        limit: { type: "number", description: "Max posts. Default: 20" },
      }, additionalProperties: false,
    },
    async execute(args: { limit?: number }) {
      await ensureSession();
      const data = await bskyFetch(`app.bsky.feed.getAuthorFeed?actor=${_session.handle}&limit=${args.limit || 20}&filter=posts_no_replies`);
      const posts = (data.feed || []).map((item: any, i: number) => {
        const p = item.post;
        const uri = p.uri;
        const rkey = uri.split("/").pop();
        const time = new Date(p.record?.createdAt || 0).toLocaleString("pl-PL");
        return `${i + 1}. [${rkey}] ${time} — ${(p.record?.text || "").slice(0, 80)}
   URI: ${uri}`;
      }).join("\n");
      return `📋 Twoje posty:\n${posts}`;
    },
  },

  bsky_delete_post: {
    name: "bsky_delete_post",
    description: "Delete one of your Bluesky posts by its record key (rkey) or full URI.",
    parameters: {
      type: "object", properties: {
        rkey: { type: "string", description: "Record key from bsky_my_posts (e.g. 3lxyzabc123), or full AT URI" },
      }, required: ["rkey"], additionalProperties: false,
    },
    async execute(args: { rkey: string }) {
      await ensureSession();
      let rkey = args.rkey;
      // If full URI was given, extract the rkey
      if (rkey.startsWith("at://")) {
        rkey = rkey.split("/").pop() || rkey;
      }
      await bskyFetch("com.atproto.repo.deleteRecord", {
        repo: _session.did,
        collection: "app.bsky.feed.post",
        rkey,
      });
      return `🗑️ Deleted post ${rkey}`;
    },
  },
};
