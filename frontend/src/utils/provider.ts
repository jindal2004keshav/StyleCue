export type LlmProvider = "anthropic" | "gemini";

export const getProviderFromQuery = (): LlmProvider | undefined => {
  if (typeof window === "undefined") return undefined;
  const param = new URLSearchParams(window.location.search).get("provider");
  return param === "anthropic" ? "anthropic" : undefined;
};
