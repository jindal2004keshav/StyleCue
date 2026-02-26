const API_BASE = "/api";

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
  pdp_url: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface Outfit {
  id: string;
  name: string;
  explanation: string;
  products: Product[];
  user_image_urls: string[];
}

export interface ConversationContext {
  initial_request: { department: string; prompt: string; preferences: Record<string, string> };
  last_outfits: Outfit[];
}

export interface ChatPayload {
  department: string;
  message: string;
  preferences?: Record<string, string>;
  images?: File[];
  conversationContext?: ConversationContext;
}

export interface ChatResponse {
  outfits: Outfit[];
  reasoning: string;
}

export async function sendChat(payload: ChatPayload): Promise<ChatResponse> {
  const form = new FormData();
  form.append("department", payload.department);
  form.append("message", payload.message);
  form.append("preferences", JSON.stringify(payload.preferences ?? {}));
  form.append(
    "conversation_context",
    JSON.stringify(payload.conversationContext ?? {}),
  );
  for (const img of payload.images ?? []) {
    form.append("images", img);
  }

  const res = await fetch(`${API_BASE}/chat`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
  return res.json() as Promise<ChatResponse>;
}

// ── Per-step helpers (mirrors test pages, useful for debugging) ───────────────

export async function stepProcessInput(
  department: string,
  message: string,
  preferences: Record<string, string> = {},
  images: File[] = [],
): Promise<{ department: string; prompt: string; preference_keys: string[]; images: object[] }> {
  const form = new FormData();
  form.append("department", department);
  form.append("message", message);
  form.append("preferences", JSON.stringify(preferences));
  for (const img of images) form.append("images", img);

  const res = await fetch(`${API_BASE}/steps/process-input`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Step 1 failed: ${res.status}`);
  return res.json();
}

export async function stepAnalyseRequirements(
  department: string,
  prompt: string,
  preferences: Record<string, string> = {},
  imageMetas: object[] = [],
  conversationContext: object = {},
): Promise<{ reasoning: string; requires_qdrant: boolean; queries: object[] }> {
  const res = await fetch(`${API_BASE}/steps/analyse-requirements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ department, prompt, preferences, image_metas: imageMetas, conversation_context: conversationContext }),
  });
  if (!res.ok) throw new Error(`Step 2 failed: ${res.status}`);
  return res.json();
}

export async function stepSearchQdrant(
  queries: object[],
): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/steps/search-qdrant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries }),
  });
  if (!res.ok) throw new Error(`Step 3 failed: ${res.status}`);
  return res.json();
}

export async function stepGenerateResponse(
  department: string,
  prompt: string,
  reasoning: string,
  products: Product[],
  preferences: Record<string, string> = {},
  requiresQdrant = false,
  conversationContext: object = {},
): Promise<{ outfits: Outfit[] }> {
  const res = await fetch(`${API_BASE}/steps/generate-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ department, prompt, preferences, reasoning, requires_qdrant: requiresQdrant, products, conversation_context: conversationContext }),
  });
  if (!res.ok) throw new Error(`Step 4 failed: ${res.status}`);
  return res.json();
}
