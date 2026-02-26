import { useState } from "react";
import { LandingPage } from "./pages/LandingPage";
import { GenderSelectPage } from "./pages/GenderSelectPage";
import { InputPage } from "./pages/InputPage";
import { ChatPage } from "./pages/ChatPage";

type Page = "landing" | "genderSelect" | "input" | "chat";

export interface InitialInput {
  department: "men" | "women";
  description: string;
  images: File[];
  preferences: Record<string, string>;
}

export default function App() {
  const [page, setPage] = useState<Page>("landing");
  const [department, setDepartment] = useState<"men" | "women">("women");
  const [initialInput, setInitialInput] = useState<InitialInput | null>(null);

  const handleGenderSelect = (dep: "men" | "women") => {
    setDepartment(dep);
    setPage("input");
  };

  const handleInputSubmit = (input: InitialInput) => {
    setInitialInput(input);
    setPage("chat");
  };

  const handleReset = () => {
    setInitialInput(null);
    setPage("landing");
  };

  if (page === "landing") {
    return (
      <LandingPage onCreateOutfit={() => setPage("genderSelect")} />
    );
  }

  if (page === "genderSelect") {
    return (
      <GenderSelectPage
        onSelect={handleGenderSelect}
        onBack={() => setPage("landing")}
      />
    );
  }

  if (page === "input") {
    return (
      <InputPage
        department={department}
        onSubmit={handleInputSubmit}
        onBack={() => setPage("genderSelect")}
      />
    );
  }

  // page === "chat"
  if (!initialInput) return null;
  return (
    <ChatPage
      initialInput={initialInput}
      onReset={handleReset}
    />
  );
}
