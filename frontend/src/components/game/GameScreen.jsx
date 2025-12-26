import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  Send,
  MessageCircle,
  AlertTriangle,
  Vote
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const mockPlayers = [
  { id: "1", name: "You", avatar: "🦊", isTraitor: false },
  { id: "2", name: "ShadowHunter", avatar: "🐺", isTraitor: true },
  { id: "3", name: "MysticRaven", avatar: "🦅", isTraitor: false },
  { id: "4", name: "NightOwl", avatar: "🦉", isTraitor: false }
]

const mockMessages = [
  { id: "1", playerId: "3", message: "My hint is: Cold", isHint: true },
  { id: "2", playerId: "4", message: "My hint is: White", isHint: true },
  { id: "3", playerId: "2", message: "My hint is: Solid", isHint: true },
  {
    id: "4",
    playerId: "1",
    message: "Hmm, interesting hints...",
    isHint: false
  }
]

const phases = [
  {
    id: "whisper",
    name: "The Whisper",
    description: "The secret word is revealed to players"
  },
  {
    id: "hint",
    name: "The Hint Drop",
    description: "Submit your hint without revealing the word"
  },
  {
    id: "suspicion",
    name: "The Suspicion",
    description: "Discuss and find the traitor"
  },
  { id: "vote", name: "The Vote", description: "Cast your vote to eliminate" }
]

const PhaseIndicator = ({ currentPhase, timeLeft }) => {
  const phaseIndex = phases.findIndex(p => p.id === currentPhase)
  const currentPhaseData = phases[phaseIndex]

  const phaseColors = {
    whisper: "from-phase-whisper to-primary",
    hint: "from-phase-hint to-secondary",
    suspicion: "from-phase-suspicion to-yellow-500",
    vote: "from-phase-vote to-destructive"
  }

  return (
    <div className="bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl p-4 animate-scale-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-3 h-3 rounded-full animate-pulse",
              currentPhase === "whisper" && "bg-phase-whisper",
              currentPhase === "hint" && "bg-phase-hint",
              currentPhase === "suspicion" && "bg-phase-suspicion",
              currentPhase === "vote" && "bg-phase-vote"
            )}
          />
          <h3 className="font-heading font-bold text-lg">
            {currentPhaseData.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono font-bold text-xl",
              timeLeft <= 10
                ? "text-destructive animate-pulse"
                : "text-foreground"
            )}
          >
            {Math.floor(timeLeft / 60)}:
            {(timeLeft % 60).toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Phase progress bar */}
      <div className="flex gap-1 mb-3">
        {phases.map((phase, index) => (
          <div
            key={phase.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-500",
              index <= phaseIndex
                ? `bg-gradient-to-r ${phaseColors[currentPhase]}`
                : "bg-muted"
            )}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {currentPhaseData.description}
      </p>
    </div>
  )
}

const PlayerListItem = ({ player, onVote, canVote }) => (
  <div
    className={cn(
      "flex items-center justify-between p-3 rounded-xl transition-all duration-300",
      player.eliminated
        ? "bg-muted/30 opacity-50"
        : "bg-card/30 hover:bg-card/50"
    )}
  >
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-xl border-2",
          player.eliminated ? "border-muted" : "border-primary/30"
        )}
      >
        {player.avatar}
      </div>
      <div>
        <p className="font-heading font-medium text-sm">{player.name}</p>
        {player.eliminated && (
          <span className="text-xs text-destructive">Eliminated</span>
        )}
      </div>
    </div>
    {canVote && !player.eliminated && (
      <Button variant="vote" size="sm" onClick={onVote}>
        <Vote className="w-4 h-4 mr-1" />
        Vote
      </Button>
    )}
  </div>
)

const ChatBox = ({ messages, players }) => {
  const getPlayer = id => players.find(p => p.id === id)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map(msg => {
          const player = getPlayer(msg.playerId)
          return (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 animate-slide-in-right",
                msg.playerId === "1" && "flex-row-reverse"
              )}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm border border-border">
                {player?.avatar}
              </div>
              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-2",
                  msg.isHint
                    ? "bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30"
                    : "bg-muted/50"
                )}
              >
                {msg.isHint && (
                  <span className="text-xs text-primary font-semibold block mb-1">
                    HINT
                  </span>
                )}
                <p className="text-sm">{msg.message}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const GameScreen = () => {
  const [currentPhase, setCurrentPhase] = useState("hint")
  const [timeLeft, setTimeLeft] = useState(45)
  const [hint, setHint] = useState("")
  const [messages, setMessages] = useState(mockMessages)
  const secretWord = "Snow"

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) return 45
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleSubmitHint = () => {
    if (!hint.trim()) return
    setMessages([
      ...messages,
      {
        id: Date.now().toString(),
        playerId: "1",
        message: `My hint is: ${hint}`,
        isHint: true
      }
    ])
    setHint("")
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 animate-fade-in-up">
          <Link to="/lobby">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Leave
            </Button>
          </Link>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/50 border border-primary/30">
            <span className="text-muted-foreground text-sm">Your word:</span>
            <span className="font-heading font-bold text-primary text-glow-cyan">
              {secretWord}
            </span>
          </div>
        </div>

        {/* Phase Indicator */}
        <div className="mb-6">
          <PhaseIndicator currentPhase={currentPhase} timeLeft={timeLeft} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Player List */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Players
            </h3>
            <div className="space-y-2">
              {mockPlayers.map(player => (
                <PlayerListItem
                  key={player.id}
                  player={player}
                  onVote={() => {}}
                  canVote={currentPhase === "vote"}
                />
              ))}
            </div>

            {/* Role Hint */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                <span className="font-heading font-semibold text-sm">
                  Your Role
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                You are a{" "}
                <span className="text-primary font-semibold">Citizen</span>.
                Find the WordTraitor!
              </p>
            </div>
          </div>

          {/* Chat & Hints */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Discussion
              </h3>
            </div>

            <div className="flex-1 bg-card/30 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden min-h-[400px]">
              <ChatBox messages={messages} players={mockPlayers} />
            </div>

            {/* Input */}
            <div className="mt-4 flex gap-3">
              <Input
                value={hint}
                onChange={e => setHint(e.target.value)}
                placeholder={
                  currentPhase === "hint"
                    ? "Enter your hint..."
                    : "Type a message..."
                }
                className="flex-1 bg-card/50 border-border/50 focus:border-primary"
                onKeyDown={e => e.key === "Enter" && handleSubmitHint()}
              />
              <Button variant="neonCyan" onClick={handleSubmitHint}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameScreen
