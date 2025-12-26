import { Settings, HelpCircle } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

const Logo = () => (
  <div className="relative animate-fade-in-up">
    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-heading font-extrabold tracking-tight">
      <span className="text-primary text-glow-cyan">Word</span>
      <span className="text-secondary text-glow-purple">Traitor</span>
    </h1>
    <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-transparent to-secondary/20 blur-3xl -z-10 opacity-60" />
  </div>
)

const ParticleBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float" />
    <div
      className="absolute top-1/3 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float"
      style={{ animationDelay: "1s" }}
    />
    <div
      className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-float"
      style={{ animationDelay: "2s" }}
    />
  </div>
)

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 gradient-mesh">
      <ParticleBackground />

      {/* Top right icons */}
      <div
        className="absolute top-6 right-6 flex items-center gap-3 animate-fade-in-up"
        style={{ animationDelay: "0.8s" }}
      >
        <Link to="/settings">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </Link>
        <Link to="/help">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
          >
            <HelpCircle className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      <div className="flex flex-col items-center gap-8 text-center z-10">
        <Logo />

        <p
          className="text-lg sm:text-xl text-muted-foreground max-w-md animate-fade-in-up font-light tracking-wide"
          style={{ animationDelay: "0.2s" }}
        >
          One word apart. One traitor among you.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 stagger-children">
          <Link to="/create">
            <Button variant="neonCyan" size="xl" className="min-w-[200px]">
              Create Circle
            </Button>
          </Link>
          <Link to="/join">
            <Button variant="glassOutline" size="xl" className="min-w-[200px]">
              Join Circle
            </Button>
          </Link>
          <Link to="/demo">
            <Button variant="glassPurple" size="xl" className="min-w-[200px]">
              Play Demo
            </Button>
          </Link>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}

export default HeroSection
