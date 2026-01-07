import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Terms = () => {
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
            <FileText className="h-10 w-10 text-purple-400" aria-hidden="true" />
            <span>Terms of Service</span>
          </h1>
          <p className="text-slate-400">Last Updated: January 2026</p>
        </header>

        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm text-slate-300">
          <CardContent className="space-y-6 p-6 sm:p-10 leading-relaxed">
            
            <section className="space-y-2" aria-labelledby="acceptance-heading">
              <h2 id="acceptance-heading" className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
              <p>
                By accessing or playing Word Traitor, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
              </p>
            </section>

            <section className="space-y-2" aria-labelledby="conduct-heading">
              <h2 id="conduct-heading" className="text-xl font-semibold text-white">2. User Conduct</h2>
              <p>
                You agree not to use the application to:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Harass, abuse, or harm another person or group.</li>
                <li>Use hate speech, offensive language, or inappropriate usernames.</li>
                <li>Interfere with or disrupt the game servers or networks.</li>
                <li>Cheat, exploit bugs, or use automated scripts.</li>
              </ul>
            </section>

            <section className="space-y-2" aria-labelledby="disclaimer-heading">
              <h2 id="disclaimer-heading" className="text-xl font-semibold text-white">3. Disclaimer</h2>
              <p>
                The materials on Word Traitor's website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement.
              </p>
            </section>

            <section className="space-y-2" aria-labelledby="liability-heading">
              <h2 id="liability-heading" className="text-xl font-semibold text-white">4. Limitation of Liability</h2>
              <p>
                In no event shall Word Traitor or its developers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on the website.
              </p>
            </section>

            <section className="space-y-2" aria-labelledby="modifications-heading">
              <h2 id="modifications-heading" className="text-xl font-semibold text-white">5. Modifications</h2>
              <p>
                We may revise these terms of service at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.
              </p>
            </section>

          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Terms;
