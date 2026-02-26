import { useState } from "react";
import { Shirt, Wand2 } from "lucide-react";
import { Header } from "./components/Header";
import { WardrobeTab } from "./components/WardrobeTab";
import { OutfitTab } from "./components/OutfitTab";

type Tab = "wardrobe" | "outfit";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("wardrobe");

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/40 via-white to-pink-50/30">
      <Header userName="Pranam Doshi" />

      {/* Hero banner */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-violet-200 text-sm mb-1" style={{ fontWeight: 500 }}>
            Your AI fashion assistant
          </p>
          <h1 className="text-white" style={{ fontWeight: 700, fontSize: "1.6rem" }}>
            What are we wearing today?
          </h1>
          <p className="text-violet-200 text-sm mt-1.5 max-w-xs leading-relaxed">
            Upload your clothes and let StyleCue craft the perfect outfit for any occasion.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab("wardrobe")}
              className={`flex items-center gap-2 px-5 py-4 text-sm border-b-2 transition-all relative ${
                activeTab === "wardrobe"
                  ? "border-violet-500 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
              }`}
              style={{ fontWeight: activeTab === "wardrobe" ? 600 : 400 }}
            >
              <Shirt className="w-4 h-4" />
              My Wardrobe
              {activeTab === "wardrobe" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-pink-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("outfit")}
              className={`flex items-center gap-2 px-5 py-4 text-sm border-b-2 transition-all relative ${
                activeTab === "outfit"
                  ? "border-violet-500 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
              }`}
              style={{ fontWeight: activeTab === "outfit" ? 600 : 400 }}
            >
              <Wand2 className="w-4 h-4" />
              Create Outfit
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white">
                AI
              </span>
              {activeTab === "outfit" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-pink-500 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {activeTab === "wardrobe" ? <WardrobeTab /> : <OutfitTab />}
      </main>
    </div>
  );
}
