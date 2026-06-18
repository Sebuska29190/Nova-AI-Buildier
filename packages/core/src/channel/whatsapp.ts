/**
 * Nexus AI WhatsApp Bridge — whatsapp-web.js integration
 *
 * Uses whatsapp-web.js (puppeteer-based) for WhatsApp Web automation.
 * First connection requires QR code scan from phone.
 */

type WAEventType = "message" | "disconnected" | "ready" | "qr";

type WAEventHandler = (data: any) => void;

interface WAMessage {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  chatName?: string;
  senderName?: string;
}

let _client: any = null;
let _ready = false;
let _qrCode: string | null = null;
let _eventHandlers: Map<WAEventType, WAEventHandler[]> = new Map();
let _connectPromise: Promise<string> | null = null;
let _qrResolve: ((qr: string) => void) | null = null;

function on(event: WAEventType, handler: WAEventHandler) {
  const handlers = _eventHandlers.get(event) || [];
  handlers.push(handler);
  _eventHandlers.set(event, handlers);
}

function emit(event: WAEventType, data: any) {
  const handlers = _eventHandlers.get(event) || [];
  handlers.forEach(h => h(data));
}

export function onWhatsAppEvent(event: WAEventType, handler: WAEventHandler) {
  on(event, handler);
}

export function isWhatsAppConnected(): boolean {
  return _ready && _client !== null;
}

export function getWhatsAppQR(): string | null {
  return _qrCode;
}

/**
 * Connect to WhatsApp Web — returns QR code as string (render as URL)
 */
export async function whatsappConnect(): Promise<string> {
  if (_ready && _client) return "Already connected";

  if (_connectPromise) {
    // If we have a QR already cached, return it
    if (_qrCode) return `Scan this QR code with WhatsApp:\n${_qrCode}`;
    return _connectPromise;
  }

  _connectPromise = new Promise(async (resolve, reject) => {
    try {
      const { Client, LocalAuth } = await import("whatsapp-web.js");

      _client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      });

      _client.on("qr", (qr: string) => {
        _qrCode = qr;
        emit("qr", qr);
        // QR is a base64 data URL — we can render it or print the text
        resolve(`QR Code received. Scan with WhatsApp:\n${qr.slice(0, 80)}...\n(Raw QR available via getWhatsAppQR())`);
      });

      _client.on("ready", () => {
        _ready = true;
        emit("ready", true);
        resolve(`WhatsApp connected as ${_client?.info?.pushname || "user"}`);
      });

      _client.on("message", (msg: any) => {
        const waMsg: WAMessage = {
          id: msg.id._serialized,
          from: msg.from,
          body: msg.body,
          timestamp: msg.timestamp,
          isGroup: msg.from.includes("-") && msg.from.includes("@g.us"),
          chatName: msg._data?.notifiedName,
          senderName: msg._data?.notifiedName,
        };
        emit("message", waMsg);
      });

      _client.on("disconnected", (reason: string) => {
        _ready = false;
        _client = null;
        _connectPromise = null;
        _qrCode = null;
        emit("disconnected", reason);
      });

      _client.on("auth_failure", (msg: string) => {
        _ready = false;
        _connectPromise = null;
        reject(new Error(`WhatsApp auth failure: ${msg}`));
      });

      await _client.initialize();
    } catch (e: any) {
      _connectPromise = null;
      reject(new Error(`WhatsApp connection failed: ${e.message}. Install whatsapp-web.js: npm install whatsapp-web.js`));
    }
  });

  // Timeout after 60s for QR
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error("WhatsApp connection timed out (60s). Check QR code scan.")), 60000)
  );

  return Promise.race([_connectPromise, timeoutPromise]);
}

/**
 * Send a WhatsApp message
 */
export async function whatsappSend(phone: string, message: string): Promise<string> {
  if (!_client) throw new Error("WhatsApp not connected. Call whatsapp_connect first.");

  // Format: if starts with +, keep; otherwise add @c.us
  const chatId = phone.includes("@") ? phone : `${phone.replace(/[^0-9]/g, "")}@c.us`;

  try {
    const chat = await _client.getChatById(chatId);
    await chat.sendMessage(message);
    return `Message sent to ${phone}`;
  } catch (e: any) {
    // Try sending via number directly
    try {
      await _client.sendMessage(chatId, message);
      return `Message sent to ${phone}`;
    } catch (e2: any) {
      throw new Error(`WhatsApp send failed: ${e2.message}`);
    }
  }
}

/**
 * Send an image on WhatsApp
 */
export async function whatsappSendImage(phone: string, caption: string, imagePath: string): Promise<string> {
  if (!_client) throw new Error("WhatsApp not connected. Call whatsapp_connect first.");
  const { MediaMessage } = await import("whatsapp-web.js");

  const chatId = phone.includes("@") ? phone : `${phone.replace(/[^0-9]/g, "")}@c.us`;

  try {
    const media = (await import("whatsapp-web.js")).MessageMedia.fromFilePath(imagePath);
    await _client.sendMessage(chatId, media, { caption });
    return `Image sent to ${phone}`;
  } catch (e: any) {
    throw new Error(`WhatsApp image send failed: ${e.message}`);
  }
}

/**
 * List recent chats
 */
export async function whatsappListChats(limit = 20): Promise<{ id: string; name: string; unread: number; lastMessage?: string }[]> {
  if (!_client) throw new Error("WhatsApp not connected. Call whatsapp_connect first.");
  try {
    const chats = await _client.getChats();
    return chats.slice(0, limit).map((c: any) => ({
      id: c.id._serialized,
      name: c.name || c.id.user || "(unknown)",
      unread: c.unreadCount || 0,
      lastMessage: c.lastMessage?.body?.slice(0, 100),
    }));
  } catch (e: any) {
    throw new Error(`WhatsApp list chats failed: ${e.message}`);
  }
}

/**
 * Get messages from a chat
 */
export async function whatsappGetMessages(chatId: string, limit = 20): Promise<WAMessage[]> {
  if (!_client) throw new Error("WhatsApp not connected. Call whatsapp_connect first.");
  try {
    const chat = await _client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });
    return messages.map((m: any) => ({
      id: m.id._serialized,
      from: m.from,
      body: m.body,
      timestamp: m.timestamp,
      isGroup: m.from.includes("@g.us"),
      senderName: m._data?.notifiedName,
    }));
  } catch (e: any) {
    throw new Error(`WhatsApp get messages failed: ${e.message}`);
  }
}

/**
 * Disconnect
 */
export async function whatsappDisconnect(): Promise<string> {
  if (_client) {
    try {
      await _client.destroy();
    } catch {}
    _client = null;
    _ready = false;
    _qrCode = null;
    _connectPromise = null;
  }
  return "WhatsApp disconnected";
}
