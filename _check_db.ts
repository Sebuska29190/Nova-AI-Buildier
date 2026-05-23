import Database from "better-sqlite3";
const db = new Database("nova.db");
const rows = db.query("SELECT id, role, substr(content,1,120) as content, tool_call_id, tool_name FROM transcripts ORDER BY id").all();
console.log(JSON.stringify(rows, null, 2));
