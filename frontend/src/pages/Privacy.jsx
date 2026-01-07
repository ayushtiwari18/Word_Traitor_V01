import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header */}
        <header className="space-y-6 text-center">
          <Link to="/">
            <Button variant="ghost" className="absolute top-6 left-6 text-slate-400 hover:text-white" aria-label="Back to Home">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
          
          <h1 className="text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
            <Shield className="h-10 w-10 text-cyan-400" aria-hidden="true" />
            <span>Privacy Policy</span>
          </h1>
          <p className="text-slate-400">Last Updated: January 2026</p>
        </header>

        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm text-slate-300">
          <CardContent className="space-y-6 p-6 sm:p-10 leading-relaxed">
            
            <section className="space-y-2" aria-labelledby="intro-heading">
              <h2 id="intro-heading" className="text-xl font-semibold text-white">1. Introduction</h2>
              <p>
                Word Traitor ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you visit our application.
              </p>
            </section>

            <section className="space-y-2" aria-labelledby="collect-heading">
              <h2 id="collect-heading" className="text-xl font-semibold text-white">2. Information We Collect</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Game Data:</strong> Temporary usernames and room codes used to facilitate gameplay.</li>
                <li><strong>Feedback:</strong> Any bugs, ratings, or messages you voluntarily submit via our feedback tool.</li>
                <li><strong>Local Storage:</strong> We use your browser's local storage to remember your session ID and game state.</li>
              </ul>
            </section>

            <section className="space-y-2" aria-labelledby="usage-heading">
              <h2 id="usage-heading" className="text-xl font-semibold text-white">3. How We Use Your Information</h2>
              <p>
                We use the collected data solely to:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Facilitate real-time gameplay between you and other players.</li>
                <li>Improve the stability and performance of the application.</li>
                <li>Review user feedback to fix bugs and enhance features.</li>
              </ul>
            </section>

            <section className="space-y-2" aria-labelledby="sharing-heading">
              <h2 id="sharing-heading" className="text-xl font-semibold text-white">4. Data Sharing</h2>
              <p>
                We do not sell, trade, or rent your personal identification information to others. Game data (such as your chosen username) is shared publicly with other players in your game room.
              </p>
            </section>

            <section className="space-y-2" aria-labelledby="contact-heading">
              <h2 id="contact-heading" className="text-xl font-semibold text-white">5. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us via the Feedback button in the application.
              </p>
            </section>

          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Privacy;
