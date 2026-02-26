import { useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Upload, Wand2, X } from "lucide-react";
import Preferences from "../components/Preferences";
import type { InitialInput } from "../App";

interface Props {
  department: "men" | "women";
  onSubmit: (input: InitialInput) => void;
  onBack: () => void;
}

interface UploadedImage {
  id: string;
  file: File;
  url: string;
  name: string;
}

export function InputPage({ department, onSubmit, onBack }: Props) {
  const [description, setDescription] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [descError, setDescError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages: UploadedImage[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }));
    setUploadedImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setUploadedImages((prev) => {
      const current = prev.find((item) => item.id === id);
      if (current) URL.revokeObjectURL(current.url);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      setDescError(true);
      return;
    }
    onSubmit({
      department,
      description: description.trim(),
      images: uploadedImages.map((img) => img.file),
      preferences,
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-violet-50/40 via-white to-pink-50/30 overflow-hidden">
      {/* Three equal sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Section 1 – Prompt */}
        <div className="p-6 border-b border-gray-100">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white text-xs flex items-center justify-center flex-shrink-0" style={{ fontWeight: 700 }}>
                1
              </span>
              <label className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>
                What are you looking for?{" "}
                <span className="text-pink-500">*</span>
              </label>
            </div>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (e.target.value.trim()) setDescError(false);
              }}
              placeholder={
                department === "women"
                  ? "e.g. Elegant evening look for a dinner date in neutral tones…"
                  : "e.g. Smart casual look for a weekend brunch, earthy tones…"
              }
              rows={4}
              className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent placeholder:text-gray-400 hover:border-violet-300 transition-colors leading-relaxed ${
                descError ? "border-red-300 bg-red-50/30 ring-2 ring-red-200" : "border-gray-200"
              }`}
            />
            {descError && (
              <p className="text-xs text-red-500">Please describe what you're looking for.</p>
            )}
          </div>
        </div>

        {/* Section 2 – Wardrobe images */}
        <div className="p-6 border-b border-gray-100">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white text-xs flex items-center justify-center flex-shrink-0" style={{ fontWeight: 700 }}>
                2
              </span>
              <label className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>
                Your wardrobe items{" "}
                <span className="text-gray-400 text-xs" style={{ fontWeight: 400 }}>(optional)</span>
              </label>
            </div>

            <div
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                dragOver
                  ? "border-violet-400 bg-violet-50"
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

            {uploadedImages.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
                {uploadedImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative group rounded-xl overflow-hidden aspect-square border border-gray-100 bg-gray-50"
                  >
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(img.id);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
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
                    <Upload className="w-4 h-4 text-gray-300" />
                    <span className="text-xs text-gray-300">Add</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3 – Preferences */}
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white text-xs flex items-center justify-center flex-shrink-0" style={{ fontWeight: 700 }}>
                3
              </span>
              <label className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>
                Refine your style{" "}
                <span className="text-gray-400 text-xs" style={{ fontWeight: 400 }}>(optional)</span>
              </label>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4">
              <Preferences onChange={setPreferences} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-violet-600 transition-colors px-3 py-2 rounded-lg hover:bg-violet-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2.5 px-8 py-3 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 text-white hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-violet-200"
            style={{ fontWeight: 600 }}
          >
            <Wand2 className="w-4 h-4" />
            Style for me
          </button>
        </div>
      </div>
    </div>
  );
}
