export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  image_url: string;
  image_urls: string[];
  pdp_url: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface Outfit {
  id: string;
  name: string;
  explanation: string;
  products: Product[];
  user_image_urls: string[];
  total_cost: number;
  currency: string;
}

export interface ConversationContext {
  initial_request: {
    department: "men" | "women";
    prompt: string;
    preferences: Record<string, string>;
  };
  last_outfits: Outfit[];
}

export interface ChatPayload {
  department: "men" | "women";
  prompt: string;
  preferences?: Record<string, string>;
  images?: File[];
  conversationContext?: ConversationContext | null;
}

export interface ChatResponse {
  outfits: Outfit[];
  reasoning: string;
}

const parseJsonSafe = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export async function sendChat(payload: ChatPayload): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append("department", payload.department);
  formData.append("prompt", payload.prompt);

  if (payload.preferences && Object.keys(payload.preferences).length > 0) {
    formData.append("preferences", JSON.stringify(payload.preferences));
  }

  if (payload.conversationContext) {
    formData.append("conversation_context", JSON.stringify(payload.conversationContext));
  }

  (payload.images ?? []).forEach((file) => {
    formData.append("images", file);
  });

  const response = await fetch("/api/chat", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  const raw = (await response.json()) as {
    outfits?: Outfit[] | string;
    reasoning?: string;
  };

  const outfits = Array.isArray(raw.outfits)
    ? raw.outfits
    : typeof raw.outfits === "string"
      ? parseJsonSafe<Outfit[]>(raw.outfits, [])
      : [];

  return {
    outfits,
    reasoning: raw.reasoning ?? "",
  };
}
