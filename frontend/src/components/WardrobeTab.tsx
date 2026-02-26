import { useState, useRef } from "react";
import { Upload, X, Tag, Shirt, Plus, Image as ImageIcon } from "lucide-react";

interface WardrobeItem {
  id: string;
  url: string;
  name: string;
  category: string;
  tags: string[];
}

const SAMPLE_ITEMS: WardrobeItem[] = [
  {
    id: "1",
    url: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
    name: "Blue Denim Jacket",
    category: "Outerwear",
    tags: ["casual", "denim"],
  },
  {
    id: "2",
    url: "https://images.unsplash.com/photo-1655252205390-ad518337dd05?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
    name: "White Summer Dress",
    category: "Dresses",
    tags: ["summer", "casual"],
  },
  {
    id: "3",
    url: "https://images.unsplash.com/photo-1528701800487-ba01fea498c0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
    name: "Black Trousers",
    category: "Bottoms",
    tags: ["formal", "office"],
  },
];

const CATEGORIES = ["All", "Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Accessories"];

export function WardrobeTab() {
  const [items, setItems] = useState<WardrobeItem[]>(SAMPLE_ITEMS);
  const [activeCategory, setActiveCategory] = useState("All");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      setItems((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          url,
          name: file.name.replace(/\.[^/.]+$/, ""),
          category: "Tops",
          tags: ["new"],
        },
      ]);
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-violet-400 bg-violet-50"
            : "border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center">
            <Upload className="w-7 h-7 text-violet-500" />
          </div>
          <div>
            <p className="text-gray-700" style={{ fontWeight: 600 }}>
              Add clothes to your wardrobe
            </p>
            <p className="text-gray-400 text-sm mt-1">Drag & drop images or click to browse</p>
          </div>
          <button className="mt-1 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white text-sm flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            Add Items
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No items in this category yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="group relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white">
              <div className="aspect-square overflow-hidden bg-gray-50">
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <button
                onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="p-3">
                <p className="text-gray-800 text-sm truncate" style={{ fontWeight: 500 }}>{item.name}</p>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                    <Shirt className="w-3 h-3" />
                    {item.category}
                  </span>
                  {item.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
