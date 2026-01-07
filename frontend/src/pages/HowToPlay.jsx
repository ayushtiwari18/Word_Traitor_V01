import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, BookOpen, Users, Brain, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const HowToPlay = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white p-6 md:p-12">
      <Helmet>
        <title>How to Play - Word Traitor Rules & Instructions</title>
        <meta name="description" content="Learn the rules of Word Traitor. Understand roles like Civilian and Traitor, how to give hints, and how to win the discussion phase." />
      </Helmet>
      
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header */}
        <header className="space-y-6 text-center">
          <Link to="/">
            <Button variant="ghost" className="absolute top-6 left-6 text-slate-400 hover:text-white" aria-label="Back to Home">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight flex items-center justify-center gap-3">
            <BookOpen className="h-10 w-10 text-cyan-400" aria-hidden="true" />
            <span>How to Play</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Master the art of deception and deduction. Here is everything you need to know to survive.
          </p>
        </header>

        {/* Roles Section */}
        <section aria-labelledby="roles-heading" className="space-y-4">
          <h2 id="roles-heading" className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-400" /> The Roles
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-cyan-400">The Civilian</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300">
                <p>You know the <strong>Secret Word</strong>. Your goal is to prove you know the word without revealing it to the Traitor.</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-slate-400">
                  <li>Give subtle hints.</li>
                  <li>Identify who is faking it.</li>
                  <li>Vote out the Traitor.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-red-400">The Traitor</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300">
                <p>You <strong>do NOT</strong> know the word. Your goal is to blend in and survive the vote.</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-slate-400">
                  <li>Listen to others' hints carefully.</li>
                  <li>Deduce the word from context.</li>
                  <li>Bluff confidently.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Game Flow Section */}
        <section aria-labelledby="flow-heading" className="space-y-4">
          <h2 id="flow-heading" className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="h-6 w-6 text-teal-400" /> Game Flow
          </h2>
          
          <div className="space-y-4">
             <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800 flex gap-4">
                <div className="bg-teal-500/20 text-teal-400 h-8 w-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Receive Word</h3>
                  <p className="text-slate-400">Everyone checks their screen. Civilians see the secret word (e.g., "Pizza"). Traitors see "You are the Traitor".</p>
                </div>
             </div>

             <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800 flex gap-4">
                <div className="bg-teal-500/20 text-teal-400 h-8 w-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Give Hints</h3>
                  <p className="text-slate-400">One by one, players give a one-word hint related to the secret word. Be careful not to be too obvious!</p>
                </div>
             </div>

             <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800 flex gap-4">
                <div className="bg-teal-500/20 text-teal-400 h-8 w-8 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Discussion & Vote</h3>
                  <p className="text-slate-400">Discuss who gave a suspicious hint. Vote for who you think is the Traitor. The player with the most votes is eliminated.</p>
                </div>
             </div>
          </div>
        </section>

        {/* Winning Conditions */}
        <section aria-labelledby="win-heading" className="space-y-4">
          <h2 id="win-heading" className="text-2xl font-bold text-white flex items-center gap-2">
            <Gavel className="h-6 w-6 text-yellow-400" /> Winning
          </h2>
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardContent className="p-6 grid md:grid-cols-2 gap-8">
               <div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-2">Civilians Win If...</h3>
                  <p className="text-slate-300">They successfully vote out the Traitor.</p>
               </div>
               <div>
                  <h3 className="text-lg font-semibold text-red-400 mb-2">Traitor Wins If...</h3>
                  <p className="text-slate-300">They survive the vote without being eliminated OR if they guess the secret word correctly after being caught.</p>
               </div>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
};

export default HowToPlay;
