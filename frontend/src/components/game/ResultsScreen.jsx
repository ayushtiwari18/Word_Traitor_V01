import { Link } from "react-router-dom"
import { Trophy, Users, Skull, RotateCcw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const mockPlayers = [
  { id: "1", name: "You", avatar: "🦊", isTraitor: false, wins: 3, losses: 1 },
  {
    id: "2",
    name: "ShadowHunter",
    avatar: "🐺",
    isTraitor: true,
    wins: 2,
    losses: 2
  },
  {
    id: "3",
    name: "MysticRaven",
    avatar: "🦅",
    isTraitor: false,
    wins: 4,
    losses: 0
  },
  {
    id: "4",
    name: "NightOwl",
    avatar: "🦉",
    isTraitor: false,
    wins: 1,
    losses: 3
  }
]

const ResultsScreen = ({ citizensWon = true }) => {
  return (
    <div className="min-h-screen bg-background gradient-mesh flex flex-col items-center justify-center px-4 py-12">
      {/* Winner Announcement */}
      <div className="text-center mb-12 animate-scale-in">
        <div
          className={cn(
            "inline-flex items-center justify-center w-24 h-24 rounded-full mb-6",
            citizensWon
              ? "bg-primary/20 border-4 border-primary glow-cyan"
              : "bg-secondary/20 border-4 border-secondary glow-purple"
          )}
        >
          {citizensWon ? (
            <Trophy className="w-12 h-12 text-primary" />
          ) : (
            <Skull className="w-12 h-12 text-secondary" />
          )}
        </div>

        <h1
          className={cn(
            "text-4xl sm:text-5xl md:text-6xl font-heading font-extrabold mb-4",
            citizensWon
              ? "text-primary text-glow-cyan"
              : "text-secondary text-glow-purple"
          )}
        >
          {citizensWon ? "Citizens Win!" : "WordTraitor Wins!"}
        </h1>

        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          {citizensWon
            ? "The traitor has been exposed. The circle remains pure."
            : "The traitor escaped detection. Deception prevails."}
        </p>
      </div>

      {/* The Traitor Reveal */}
      <div
        className="mb-12 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-secondary/30 animate-fade-in-up"
        style={{ animationDelay: "0.3s" }}
      >
        <p className="text-sm text-muted-foreground mb-3 text-center">
          The WordTraitor was...
        </p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary/30 to-destructive/30 flex items-center justify-center text-3xl border-2 border-secondary">
            🐺
          </div>
          <div>
            <p className="font-heading font-bold text-xl text-secondary">
              ShadowHunter
            </p>
            <p className="text-sm text-muted-foreground">
              Their word was:{" "}
              <span className="text-foreground font-semibold">"Rain"</span>
            </p>
          </div>
        </div>
      </div>

      {/* Player Stats */}
      <div className="w-full max-w-2xl mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-heading font-semibold text-lg">Player Stats</h2>
        </div>

        <div className="grid gap-3 stagger-children">
          {mockPlayers.map(player => (
            <div
              key={player.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-all",
                player.isTraitor
                  ? "bg-secondary/10 border-secondary/30"
                  : "bg-card/30 border-border/50"
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-xl border-2",
                    player.isTraitor ? "border-secondary" : "border-primary/30"
                  )}
                >
                  {player.avatar}
                </div>
                <div>
                  <p className="font-heading font-semibold">{player.name}</p>
                  {player.isTraitor && (
                    <span className="text-xs text-secondary font-medium">
                      WordTraitor
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-primary font-bold">{player.wins}</p>
                  <p className="text-muted-foreground text-xs">Wins</p>
                </div>
                <div className="text-center">
                  <p className="text-destructive font-bold">{player.losses}</p>
                  <p className="text-muted-foreground text-xs">Losses</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up"
        style={{ animationDelay: "0.6s" }}
      >
        <Link to="/lobby">
          <Button variant="neonCyan" size="xl" className="min-w-[200px] gap-2">
            <RotateCcw className="w-5 h-5" />
            Play Again
          </Button>
        </Link>
        <Link to="/">
          <Button
            variant="glassOutline"
            size="xl"
            className="min-w-[200px] gap-2"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default ResultsScreen
