import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Copy,
  Check,
  Users,
  Wifi,
  Zap,
  UserPlus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const mockPlayers = [
  { id: "1", name: "Player 1 (You)", avatar: "🦊", ready: true },
  { id: "2", name: "ShadowHunter", avatar: "🐺", ready: true },
  { id: "3", name: "MysticRaven", avatar: "🦅", ready: false },
  { id: "4", name: "NightOwl", avatar: "🦉", ready: true }
]

const gameModes = [
  {
    id: "silent",
    name: "Silent Circle",
    icon: Wifi,
    description: "Online play with typed hints"
  },
  {
    id: "real",
    name: "Real Circle",
    icon: Users,
    description: "In-person with voice hints"
  },
  {
    id: "flash",
    name: "Flash Round",
    icon: Zap,
    description: "Quick 2-minute rounds"
  }
]

const PlayerCard = ({ player }) => (
  <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm animate-scale-in">
    <div className="relative">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-2xl border-2 border-primary/50">
        {player.avatar}
      </div>
      {player.ready && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
    </div>
    <div className="flex-1">
      <p className="font-heading font-semibold text-foreground">
        {player.name}
      </p>
      <p className="text-sm text-muted-foreground">
        {player.ready ? "Ready" : "Waiting..."}
      </p>
    </div>
  </div>
)

const LobbyScreen = () => {
  const navigate = useNavigate()
  const [selectedMode, setSelectedMode] = useState("silent")
  const [copied, setCopied] = useState(false)
  const circleCode = "WORD-7X9K"

  const handleCopy = () => {
    navigator.clipboard.writeText(circleCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allReady = mockPlayers.every(p => p.ready)

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-sm">
              Circle Code:
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
              <span className="font-heading font-bold text-primary tracking-wider">
                {circleCode}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Player List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold text-foreground">
                Players ({mockPlayers.length}/8)
              </h2>
              <span className="text-sm text-muted-foreground">
                {mockPlayers.filter(p => p.ready).length} ready
              </span>
            </div>
            <div className="space-y-3 stagger-children">
              {mockPlayers.map(player => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
            <Button variant="glassOutline" className="w-full gap-2 mt-4">
              <UserPlus className="w-4 h-4" />
              Invite Friends
            </Button>
          </div>

          {/* Mode Selection */}
          <div className="space-y-4">
            <h2 className="text-xl font-heading font-bold text-foreground">
              Game Mode
            </h2>
            <div className="space-y-3">
              {gameModes.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 text-left",
                    selectedMode === mode.id
                      ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(180_100%_50%/0.2)]"
                      : "border-border/50 bg-card/30 hover:border-border hover:bg-card/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      selectedMode === mode.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <mode.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p
                      className={cn(
                        "font-heading font-semibold transition-colors",
                        selectedMode === mode.id
                          ? "text-primary"
                          : "text-foreground"
                      )}
                    >
                      {mode.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {mode.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div
          className="mt-12 flex justify-center animate-fade-in-up"
          style={{ animationDelay: "0.5s" }}
        >
          <Button
            variant="neonCyan"
            size="xl"
            className="min-w-[280px]"
            disabled={!allReady}
            onClick={() => navigate("/game")}
          >
            {allReady ? "Start Game" : "Waiting for players..."}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LobbyScreen
