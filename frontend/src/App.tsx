import ChatWindow from "./components/ChatWindow";

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "14px 24px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>StyleCue</h1>
      </header>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <ChatWindow />
      </main>
    </div>
  );
}
