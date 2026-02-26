import { Sparkles, User, Bell } from "lucide-react";

interface HeaderProps {
  userName?: string;
}

export function Header({ userName = "Alex Rivera" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo / App Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span
            className="text-gray-900"
            style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            Style<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-pink-500">Cue</span>
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-full hover:bg-gray-50 transition-colors">
            <Bell className="w-5 h-5 text-gray-500" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full" />
          </button>
          <div className="flex items-center gap-2.5 bg-gray-50 rounded-full pl-1 pr-3 py-1 border border-gray-100 hover:border-violet-200 transition-colors cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>
              {userName}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
