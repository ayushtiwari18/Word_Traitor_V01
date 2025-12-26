import { Link } from "react-router-dom"
import {
  ArrowLeft,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
  Users,
  Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"
import { cn } from "@/lib/utils"

const modes = [
  { id: "silent", name: "Silent Circle", icon: Wifi },
  { id: "real", name: "Real Circle", icon: Users },
  { id: "flash", name: "Flash Round", icon: Zap }
]

const SettingsScreen = () => {
  const [darkMode, setDarkMode] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [defaultMode, setDefaultMode] = useState("silent")

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
          <h1 className="text-2xl font-heading font-bold">Settings</h1>
        </div>

        <div className="space-y-6 stagger-children">
          {/* Theme Toggle */}
          <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {darkMode ? (
                  <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <Moon className="w-6 h-6 text-secondary" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Sun className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-heading font-semibold">Theme</p>
                  <p className="text-sm text-muted-foreground">
                    {darkMode ? "Dark Mode" : "Light Mode"}
                  </p>
                </div>
              </div>
              <Switch
                checked={darkMode}
                onCheckedChange={setDarkMode}
                className="data-[state=checked]:bg-secondary"
              />
            </div>
          </div>

          {/* Sound Toggle */}
          <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    soundOn ? "bg-primary/20" : "bg-muted"
                  )}
                >
                  {soundOn ? (
                    <Volume2 className="w-6 h-6 text-primary" />
                  ) : (
                    <VolumeX className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-heading font-semibold">Sound</p>
                  <p className="text-sm text-muted-foreground">
                    {soundOn ? "Sound On" : "Sound Off"}
                  </p>
                </div>
              </div>
              <Switch
                checked={soundOn}
                onCheckedChange={setSoundOn}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>

          {/* Default Mode */}
          <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
            <p className="font-heading font-semibold mb-4">Default Game Mode</p>
            <div className="space-y-2">
              {modes.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setDefaultMode(mode.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 text-left",
                    defaultMode === mode.id
                      ? "border-primary bg-primary/10"
                      : "border-transparent bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                      defaultMode === mode.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <mode.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={cn(
                      "font-medium transition-colors",
                      defaultMode === mode.id
                        ? "text-primary"
                        : "text-foreground"
                    )}
                  >
                    {mode.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsScreen
