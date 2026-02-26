import { useMemo, useRef, useState } from "react";
import {
  Upload,
  X,
  Sparkles,
  ChevronDown,
  ImagePlus,
  Wand2,
  RotateCcw,
  Send,
  User,
  Heart,
} from "lucide-react";
import { sendChat, type ConversationContext, type Outfit } from "../utils/api";
import { getProviderFromQuery } from "../utils/provider";
import { useWishlist } from "../hooks/useWishlist";
import { OutfitCard } from "./OutfitCard";
import { WishlistPanel } from "./WishlistPanel";

const MATERIALS = ["Select material", "cotton", "silk", "polyester", "nylon", "linen"];
const FITS = ["Select fit", "regular", "skinny", "oversized", "comfort", "slim"];
const OCCASIONS = ["Select occasion", "casual", "party", "everyday", "workwear", "elevated"];

interface UploadedImage {
  id: string;
  file: File;
  url: string;
  name: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  outfits?: Outfit[];
}

interface SubmittedInput {
  department: "men" | "women";
  images: UploadedImage[];
  description: string;
  material: string;
  fit: string;
  occasion: string;
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label?: string;
}

function Select({ value, onChange, options, label }: SelectProps) {
  return (
    <div className="relative">
      {label && (
        <label className="block text-xs text-gray-500 mb-1" style={{ fontWeight: 500 }}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 pr-9 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent cursor-pointer hover:border-violet-300 transition-colors"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

export function OutfitTab() {
  const [department, setDepartment] = useState<"men" | "women" | "">("");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState(MATERIALS[0]);
  const [fit, setFit] = useState(FITS[0]);
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [dragOver, setDragOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatReplying, setIsChatReplying] = useState(false);
  const [errors, setErrors] = useState<{ department?: string; imageOrDesc?: string; api?: string }>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [submittedInput, setSubmittedInput] = useState<SubmittedInput | null>(null);
  const [conversationContext, setConversationContext] = useState<ConversationContext | null>(null);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const provider = getProviderFromQuery();

  const { wishlist, addOutfit, removeOutfit, isWishlisted } = useWishlist();

  const assistantOutfits = useMemo(
    () => chatMessages.filter((message) => message.role === "assistant").flatMap((message) => message.outfits ?? []),
    [chatMessages],
  );

  const hasResults = assistantOutfits.length > 0;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const newImages: UploadedImage[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }));

    setUploadedImages((prev) => [...prev, ...newImages]);
    setErrors((prev) => ({ ...prev, imageOrDesc: undefined }));
  };

  const removeImage = (id: string) => {
    setUploadedImages((prev) => {
      const current = prev.find((item) => item.id === id);
      if (current) URL.revokeObjectURL(current.url);
      return prev.filter((item) => item.id !== id);
    });
  };

  const validate = () => {
    const next: { department?: string; imageOrDesc?: string } = {};

    if (!department) next.department = "Please select who you're styling.";
    if (uploadedImages.length === 0 && !description.trim()) {
      next.imageOrDesc = "Please upload an image or add a description.";
    }

    setErrors((prev) => ({ ...prev, ...next, api: undefined }));
    return Object.keys(next).length === 0;
  };

  const buildPreferences = () => {
    const preferences: Record<string, string> = {};
    if (material !== MATERIALS[0]) preferences.Material = material;
    if (fit !== FITS[0]) preferences.Fit = fit;
    if (occasion !== OCCASIONS[0]) preferences.Occasion = occasion;
    return preferences;
  };

  const handleToggleWishlist = (outfit: Outfit) => {
    if (isWishlisted(outfit.id)) {
      removeOutfit(outfit.id);
      return;
    }
    addOutfit(outfit);
  };

  const handleStyleMe = async () => {
    if (!validate()) return;

    const selectedDepartment = department as "men" | "women";
    const preferences = buildPreferences();
    const prompt = description.trim() || "Create outfit suggestions based on uploaded items.";

    setIsGenerating(true);
    setErrors((prev) => ({ ...prev, api: undefined }));

    try {
      const response = await sendChat({
        department: selectedDepartment,
        prompt,
        preferences,
        images: uploadedImages.map((item) => item.file),
        llmProvider: provider,
      });

      setSubmittedInput({ department: selectedDepartment, images: uploadedImages, description, material, fit, occasion });
      setChatMessages([
        { id: `${Date.now()}-u`, role: "user", text: prompt },
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          text: response.reasoning || "Here are your generated outfits.",
          outfits: response.outfits,
        },
      ]);

      setConversationContext({
        initial_request: { department: selectedDepartment, prompt, preferences },
        last_outfits: response.outfits,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate outfits.";
      setErrors((prev) => ({ ...prev, api: message }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || isChatReplying || !submittedInput) return;

    setChatMessages((prev) => [...prev, { id: `${Date.now()}-u2`, role: "user", text }]);
    setChatInput("");
    setIsChatReplying(true);
    setErrors((prev) => ({ ...prev, api: undefined }));

    try {
      const response = await sendChat({
        department: submittedInput.department,
        prompt: text,
        preferences: conversationContext?.initial_request.preferences ?? {},
        conversationContext,
        llmProvider: provider,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-a2`,
          role: "assistant",
          text: response.reasoning || "Updated outfits ready.",
          outfits: response.outfits,
        },
      ]);

      setConversationContext((prev) => {
        const fallbackInitial = {
          department: submittedInput.department,
          prompt: submittedInput.description.trim() || "Create outfit suggestions based on uploaded items.",
          preferences: buildPreferences(),
        };

        return {
          initial_request: prev?.initial_request ?? fallbackInitial,
          last_outfits: response.outfits,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to refine outfits.";
      setErrors((prev) => ({ ...prev, api: message }));
    } finally {
      setIsChatReplying(false);
      chatInputRef.current?.focus();
    }
  };

  const handleReset = () => {
    uploadedImages.forEach((item) => URL.revokeObjectURL(item.url));
    setUploadedImages([]);
    setDescription("");
    setDepartment("");
    setMaterial(MATERIALS[0]);
    setFit(FITS[0]);
    setOccasion(OCCASIONS[0]);
    setErrors({});
    setChatMessages([]);
    setChatInput("");
    setSubmittedInput(null);
    setConversationContext(null);
  };

  return (
    <div className="space-y-6">
      {hasResults && (
        <div className="space-y-5">
          {submittedInput && (
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-pink-50/40 p-4 space-y-3">
              <p className="text-xs text-violet-500 uppercase tracking-wide" style={{ fontWeight: 600 }}>
                Your Style Request
              </p>
              <div className="flex items-center gap-2">
                <span className="text-base">{submittedInput.department === "women" ? "👗" : "👔"}</span>
                <span
                  className={`text-sm px-3 py-1 rounded-full border ${
                    submittedInput.department === "women"
                      ? "bg-pink-50 text-pink-700 border-pink-200"
                      : "bg-violet-50 text-violet-700 border-violet-200"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  {submittedInput.department === "women" ? "For Her" : "For Him"}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-gray-900" style={{ fontWeight: 700 }}>
                AI Outfit Results
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">Live results from StyleCue backend pipeline</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsWishlistOpen(true)}
                className="flex items-center gap-1.5 text-sm text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg hover:bg-rose-100"
              >
                <Heart className="w-4 h-4" />
                Wishlist ({wishlist.length})
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-violet-50"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
            </div>
          </div>

          <div className="space-y-4">
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
                  {((msg.role === "user") || !msg.outfits || msg.outfits.length === 0) && (
                    <div
                      className={`max-w-xl px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-violet-500 to-pink-500 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-700 rounded-bl-sm border border-gray-100"
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}
                </div>

                {msg.outfits && msg.outfits.length > 0 && (
                  <div className="w-full space-y-3">
                    {msg.outfits.map((outfit) => (
                      <OutfitCard
                        key={`${msg.id}-${outfit.id}`}
                        outfit={outfit}
                        isWishlisted={isWishlisted(outfit.id)}
                        onWishlist={() => handleToggleWishlist(outfit)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isChatReplying && (
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
          </div>

          <div className="pt-2">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-100 text-sm text-gray-600 leading-relaxed">
                Ask for refinements like: "make it formal", "add a jacket", or "budget under $80".
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                placeholder="Refine these outfits..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder:text-gray-400"
              />
              <button
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

      {!hasResults && (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm border border-gray-100">
              <p className="text-gray-700 text-sm leading-relaxed">
                Upload what you own, add your style intent, and StyleCue will generate complete outfits from live catalog products.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 flex-shrink-0" />
            <div className="flex-1">
              <label
                className="block text-xs mb-2"
                style={{ fontWeight: 600, color: department === "" && errors.department ? "#e53e3e" : "#6b7280" }}
              >
                Who are you styling? <span className="text-pink-500">*</span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDepartment("men");
                    setErrors((prev) => ({ ...prev, department: undefined }));
                  }}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border-2 transition-all text-sm flex-1 justify-center ${
                    department === "men"
                      ? "border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50 text-violet-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:bg-violet-50/40"
                  }`}
                  style={{ fontWeight: department === "men" ? 600 : 400 }}
                >
                  <span className="text-lg">👔</span>
                  <span>For Him</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDepartment("women");
                    setErrors((prev) => ({ ...prev, department: undefined }));
                  }}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border-2 transition-all text-sm flex-1 justify-center ${
                    department === "women"
                      ? "border-pink-500 bg-gradient-to-br from-pink-50 to-rose-50 text-pink-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-pink-300 hover:bg-pink-50/40"
                  }`}
                  style={{ fontWeight: department === "women" ? 600 : 400 }}
                >
                  <span className="text-lg">👗</span>
                  <span>For Her</span>
                </button>
              </div>
              {errors.department && <p className="text-xs text-red-500 mt-1.5">{errors.department}</p>}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 flex-shrink-0" />
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ fontWeight: 500, color: errors.imageOrDesc ? "#e53e3e" : "#6b7280" }}>
                Upload clothing images <span className="text-gray-400 text-xs">(required if no description)</span>
              </label>
              <div
                className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
                  dragOver
                    ? "border-violet-400 bg-violet-50"
                    : errors.imageOrDesc
                      ? "border-red-300 bg-red-50/30 hover:border-red-400"
                      : "border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center">
                    <ImagePlus className="w-5 h-5 text-violet-500" />
                  </div>
                  <p className="text-gray-600 text-sm" style={{ fontWeight: 500 }}>
                    Drop your images here
                  </p>
                  <p className="text-gray-400 text-xs">PNG, JPG, WEBP up to 10MB each</p>
                </div>
              </div>
            </div>
          </div>

          {uploadedImages.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="w-9 flex-shrink-0" />
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-2" style={{ fontWeight: 500 }}>
                  Uploaded items ({uploadedImages.length})
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden aspect-square border border-gray-100 bg-gray-50">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/50 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-5 h-5 text-gray-300" />
                      <span className="text-xs text-gray-300">Add more</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-9 flex-shrink-0" />
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ fontWeight: 500, color: errors.imageOrDesc ? "#e53e3e" : "#6b7280" }}>
                Describe your style intent <span className="text-gray-400 text-xs">(required if no image)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (e.target.value.trim()) setErrors((prev) => ({ ...prev, imageOrDesc: undefined }));
                }}
                placeholder="e.g. Casual look for weekend coffee in neutral tones"
                rows={3}
                className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent placeholder:text-gray-400 hover:border-violet-300 transition-colors leading-relaxed ${
                  errors.imageOrDesc ? "border-red-300 bg-red-50/30" : "border-gray-200"
                }`}
              />
              {errors.imageOrDesc && <p className="text-xs text-red-500 mt-1.5">{errors.imageOrDesc}</p>}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-2" style={{ fontWeight: 500 }}>
                Optional preferences
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select label="Material" value={material} onChange={setMaterial} options={MATERIALS} />
                <Select label="Fit" value={fit} onChange={setFit} options={FITS} />
                <Select label="Occasion" value={occasion} onChange={setOccasion} options={OCCASIONS} />
              </div>
            </div>
          </div>

          {errors.api && (
            <div className="mx-12 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-3">{errors.api}</div>
          )}

          <div className="flex justify-center pt-2">
            <button
              onClick={handleStyleMe}
              disabled={isGenerating}
              className="px-10 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 text-white flex items-center gap-2.5 hover:opacity-90 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-violet-200 hover:shadow-violet-300"
              style={{ fontWeight: 600 }}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Styling your look...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Style Me
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {errors.api && hasResults && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-3">{errors.api}</div>
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
