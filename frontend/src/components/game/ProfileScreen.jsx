import { Link } from "react-router-dom"
import {
  ArrowLeft,
  Trophy,
  Target,
  Skull,
  Shield,
  Sparkles,
  Award
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const achievements = [
  {
    id: "1",
    name: "First Win",
    description: "Win your first game",
    icon: Trophy,
    unlocked: true,
    rarity: "common"
  },
  {
    id: "2",
    name: "Sharp Eye",
    description: "Identify the traitor in the first round",
    icon: Target,
    unlocked: true,
    rarity: "rare"
  },
  {
    id: "3",
    name: "Master Deceiver",
    description: "Win 5 games as WordTraitor",
    icon: Skull,
    unlocked: false,
    rarity: "epic"
  },
  {
    id: "4",
    name: "Guardian",
    description: "Never vote for a citizen",
    icon: Shield,
    unlocked: true,
    rarity: "common"
  },
  {
    id: "5",
    name: "Perfect Game",
    description: "Win without any wrong votes",
    icon: Sparkles,
    unlocked: false,
    rarity: "legendary"
  },
  {
    id: "6",
    name: "Veteran",
    description: "Play 50 games",
    icon: Award,
    unlocked: false,
    rarity: "rare"
  }
]

const rarityColors = {
  common: "border-muted-foreground/30 bg-muted/20",
  rare: "border-primary/50 bg-primary/10",
  epic: "border-secondary/50 bg-secondary/10",
  legendary: "border-yellow-500/50 bg-yellow-500/10"
}

const rarityGlow = {
  common: "",
  rare: "hover:shadow-[0_0_15px_hsl(180_100%_50%/0.3)]",
  epic: "hover:shadow-[0_0_15px_hsl(271_76%_53%/0.3)]",
  legendary: "hover:shadow-[0_0_20px_hsl(45_100%_50%/0.4)]"
}

const ProfileScreen = () => {
  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 animate-fade-in-up">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-heading font-bold">Profile</h1>
        </div>

        {/* Profile Card */}
        <div className="p-8 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 mb-8 animate-scale-in">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-5xl border-4 border-primary/50 glow-cyan-sm">
                🦊
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                12
              </div>
            </div>
            <h2 className="text-2xl font-heading font-bold mb-1">CyberFox</h2>
            <p className="text-muted-foreground text-sm">
              Playing since Dec 2024
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 stagger-children">
          <div className="p-4 rounded-xl bg-card/30 border border-border/50 text-center">
            <p className="text-3xl font-heading font-bold text-primary">24</p>
            <p className="text-sm text-muted-foreground">Games</p>
          </div>
          <div className="p-4 rounded-xl bg-card/30 border border-border/50 text-center">
            <p className="text-3xl font-heading font-bold text-primary">18</p>
            <p className="text-sm text-muted-foreground">Wins</p>
          </div>
          <div className="p-4 rounded-xl bg-card/30 border border-border/50 text-center">
            <p className="text-3xl font-heading font-bold text-secondary">6</p>
            <p className="text-sm text-muted-foreground">Losses</p>
          </div>
        </div>

        {/* Achievements */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <h3 className="font-heading font-semibold text-lg mb-4">
            Achievements
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {achievements.map(achievement => (
              <div
                key={achievement.id}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-300 text-center",
                  rarityColors[achievement.rarity],
                  rarityGlow[achievement.rarity],
                  !achievement.unlocked && "opacity-40 grayscale"
                )}
              >
                <div
                  className={cn(
                    "w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center",
                    achievement.unlocked ? "bg-background/50" : "bg-muted"
                  )}
                >
                  <achievement.icon
                    className={cn(
                      "w-6 h-6",
                      achievement.rarity === "common" &&
                        "text-muted-foreground",
                      achievement.rarity === "rare" && "text-primary",
                      achievement.rarity === "epic" && "text-secondary",
                      achievement.rarity === "legendary" && "text-yellow-500"
                    )}
                  />
                </div>
                <p className="font-heading font-semibold text-sm mb-1">
                  {achievement.name}
                </p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {achievement.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileScreen
