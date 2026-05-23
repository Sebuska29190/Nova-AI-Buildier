// Cloud save — GitHub Gist sync (1:1 z CheetahClaws)
export async function uploadSession(token: string, title: string, content: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        description: title, public: false,
        files: { [title.replace(/[^a-z0-9]/gi, "_") + ".json"]: { content } },
      }),
    });
    const data: any = await res.json();
    return data?.id || null;
  } catch { return null; }
}

export async function listSessions(token: string): Promise<Array<{ id: string; title: string }>> {
  try {
    const res = await fetch(`https://api.github.com/gists?per_page=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await res.json();
    return (data || []).map((g: any) => ({ id: g.id, title: g.description || "Untitled" }));
  } catch { return []; }
}
