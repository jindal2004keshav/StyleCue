import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, Send, Sparkles, User } from "lucide-react";
import { sendChat, type ConversationContext, type Outfit } from "../utils/api";
import { getProviderFromQuery } from "../utils/provider";
import { useWishlist } from "../hooks/useWishlist";
import { OutfitCard } from "../components/OutfitCard";
import { WishlistPanel } from "../components/WishlistPanel";
import type { InitialInput } from "../App";

interface Props {
  initialInput: InitialInput;
  onReset: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  outfits?: Outfit[];
  /** true for the first user message that shows thumbnails */
  isInitial?: boolean;
}

export function ChatPage({ initialInput, onReset }: Props) {
  const { department, description, images, preferences } = initialInput;

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isChatReplying, setIsChatReplying] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [conversationContext, setConversationContext] = useState<ConversationContext | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  const chatInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const provider = getProviderFromQuery();
  const { wishlist, addOutfit, removeOutfit, isWishlisted } = useWishlist();

  const hasFirstResponse = chatMessages.some((m) => m.role === "assistant");

  // Create object URLs for image thumbnails
  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setImageUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []); // intentionally empty — images ref is stable from parent

  // Fire initial API call on mount
  useEffect(() => {
    // Seed the initial user message
    setChatMessages([
      {
        id: "initial-user",
        role: "user",
        text: description,
        isInitial: true,
      },
    ]);

    const fire = async () => {
      try {
        const response = await sendChat({
          department,
          prompt: description,
          preferences,
          images,
          llmProvider: provider,
        });

        setChatMessages((prev) => [
          ...prev,
          {
            id: "initial-ai",
            role: "assistant",
            text: response.reasoning || "Here are your generated outfits.",
            outfits: response.outfits,
          },
        ]);

        setConversationContext({
          initial_request: { department, prompt: description, preferences },
          last_outfits: response.outfits,
        });
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Failed to generate outfits.");
      } finally {
        setIsLoading(false);
      }
    };

    fire();
  }, []); // intentionally empty — fires once on mount

  // Auto-scroll after each message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isLoading]);

  // Focus chat input after first response lands
  useEffect(() => {
    if (hasFirstResponse) {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [hasFirstResponse]);

  const handleToggleWishlist = (outfit: Outfit) => {
    if (isWishlisted(outfit.id)) {
      removeOutfit(outfit.id);
    } else {
      addOutfit(outfit);
    }
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || isChatReplying) return;

    const userMsgId = `user-${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: userMsgId, role: "user", text }]);
    setChatInput("");
    setIsChatReplying(true);
    setApiError(null);

    try {
      const response = await sendChat({
        department,
        prompt: text,
        preferences: conversationContext?.initial_request.preferences ?? preferences,
        conversationContext,
        llmProvider: provider,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          text: response.reasoning || "Updated outfits ready.",
          outfits: response.outfits,
        },
      ]);

      setConversationContext((prev) => ({
        initial_request: prev?.initial_request ?? { department, prompt: description, preferences },
        last_outfits: response.outfits,
      }));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to refine outfits.");
    } finally {
      setIsChatReplying(false);
      chatInputRef.current?.focus();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-violet-50/40 via-white to-pink-50/30">
      {/* Top bar */}
      <header className="flex-shrink-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-gray-900" style={{ fontWeight: 700 }}>
              StyleCue
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              className="flex items-center gap-1.5 text-sm text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-colors"
            >
              <Heart className="w-4 h-4" />
              <span style={{ fontWeight: 500 }}>{wishlist.length}</span>
            </button>
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Start over
            </button>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-6 py-6 space-y-5">
          {chatMessages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {msg.role === "assistant" ? (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                )}

                {/* Bubble — always shown for user; for assistant only if no outfits */}
                {(msg.role === "user" || !msg.outfits || msg.outfits.length === 0) && (
                  <div
                    className={`max-w-xl px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-violet-500 to-pink-500 text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-700 rounded-bl-sm border border-gray-100"
                    }`}
                  >
                    <p>{msg.text}</p>
                    {/* Image thumbnails in initial user message */}
                    {msg.isInitial && imageUrls.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {imageUrls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Uploaded ${i + 1}`}
                            className="w-12 h-12 rounded-lg object-cover border border-white/30"
                          />
                        ))}
                      </div>
                    )}
                    {/* Department badge in initial user message */}
                    {msg.isInitial && (
                      <div className="mt-2">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full bg-white/20 border border-white/30"
                          style={{ fontWeight: 600 }}
                        >
                          {department === "women" ? "👗 For Women" : "👔 For Men"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Outfit results — annotation + responsive card grid */}
              {msg.outfits && msg.outfits.length > 0 && (
                <div className="space-y-3 mt-1">
                  {msg.text && (
                    <div className="flex items-center gap-2 pl-1">
                      <div className="w-5 h-px bg-gray-200" />
                      <p className="text-xs text-gray-400 italic leading-relaxed">{msg.text}</p>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {msg.outfits.map((outfit) => (
                      <OutfitCard
                        key={`${msg.id}-${outfit.id}`}
                        outfit={outfit}
                        isWishlisted={isWishlisted(outfit.id)}
                        onWishlist={() => handleToggleWishlist(outfit)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {(isLoading || isChatReplying) && (
            <div className="flex items-end gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 border border-gray-100">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* API error */}
          {apiError && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-3">
              {apiError}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Chat input bar — only appears after first response */}
      {hasFirstResponse && (
        <div className="flex-shrink-0 border-t border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-3">
          <div className="w-full">
            <div className="flex items-start gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs text-gray-400 leading-relaxed pt-1.5">
                Ask for refinements like "make it formal", "add a jacket", or "budget under $80".
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                placeholder="Refine these outfits…"
                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={handleChatSend}
                disabled={!chatInput.trim() || isChatReplying}
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      <WishlistPanel
        isOpen={isWishlistOpen}
        outfits={wishlist}
        isWishlisted={isWishlisted}
        onToggleOutfit={handleToggleWishlist}
        onClose={() => setIsWishlistOpen(false)}
      />
    </div>
  );
}
