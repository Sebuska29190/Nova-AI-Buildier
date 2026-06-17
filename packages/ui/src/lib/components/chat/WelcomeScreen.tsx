/**
 * WelcomeScreen — Empty state with action cards
 */

interface WelcomeScreenProps {
  onSelectPrompt: (text: string) => void;
}

const ACTION_CARDS = [
  { icon: "💻", label: "Code Review", prompt: "Review the code in this project for bugs, security issues, and improvements" },
  { icon: "🔍", label: "Analyze Project", prompt: "Analyze the project structure and provide a comprehensive overview" },
  { icon: "📝", label: "Write Docs", prompt: "Write comprehensive documentation for this project" },
  { icon: "🐛", label: "Debug Bug", prompt: "Investigate and fix the reported bug in this codebase" },
  { icon: "🧪", label: "Write Tests", prompt: "Write unit tests for the core functions in this project" },
  { icon: "📦", label: "Deploy Setup", prompt: "Help me set up Docker deployment for this project" },
];

export function WelcomeScreen({ onSelectPrompt }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-lg">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(99,102,241,0.2)]">
          <span className="text-2xl font-bold text-white">N</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Nova AI Agent</h2>
        <p className="text-sm text-[#475569] mb-8">What can I help you build today?</p>

        {/* Action Cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {ACTION_CARDS.map((card) => (
            <button
              key={card.label}
              onClick={() => onSelectPrompt(card.prompt)}
              className="glass-card p-4 text-left hover:border-[rgba(99,102,241,0.2)] transition-all group"
            >
              <span className="text-xl block mb-2">{card.icon}</span>
              <p className="text-xs text-white font-medium mb-1">{card.label}</p>
              <p className="text-[10px] text-[#475569] line-clamp-2">{card.prompt}</p>
            </button>
          ))}
        </div>

        {/* Hints */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-[#475569]">
          <span>Type <kbd className="px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[#94a3b8] font-mono">/</kbd> for commands</span>
          <span>Type <kbd className="px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[#94a3b8] font-mono">@</kbd> for files</span>
          <span>Attach files with 📎</span>
        </div>
      </div>
    </div>
  );
}
