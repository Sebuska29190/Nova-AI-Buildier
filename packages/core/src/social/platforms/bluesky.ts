/**
 * Bluesky API posting — uses @atproto API
 */

export async function postToBluesky(config: Record<string, string>, text: string, mediaPath?: string): Promise<string> {
  const serviceUrl = config.service_url || "https://bsky.social";
  const identifier = config.identifier;
  const password = config.password;

  if (!identifier || !password) {
    throw new Error("Bluesky credentials not configured. Set identifier and password in account config.");
  }

  // Step 1: Create session
  const sessionRes = await fetch(`${serviceUrl}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  if (!sessionRes.ok) throw new Error(`Bluesky auth failed: ${sessionRes.status}`);
  const session = await sessionRes.json();
  const accessToken = session.accessJwt;
  const did = session.did;

  // Step 2: Create post record
  const record = {
    $type: "app.bsky.feed.post",
    text: text,
    createdAt: new Date().toISOString(),
  };

  const postRes = await fetch(`${serviceUrl}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      repo: did,
      collection: "app.bsky.feed.post",
      record,
    }),
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    throw new Error(`Bluesky post failed: ${err}`);
  }

  const result = await postRes.json();
  return `Posted to Bluesky: ${result.uri}`;
}
