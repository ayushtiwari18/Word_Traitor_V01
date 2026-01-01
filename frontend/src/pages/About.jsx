import { Link } from "react-router-dom";
import { ArrowLeft, Github, Linkedin, Code2, Users, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const developers = [
  {
    name: "Ayush Tiwari",
    role: "Lead Developer",
    image: "/Ayush.png",
    github: "https://github.com/ayushtiwari18",
    linkedin: "https://www.linkedin.com/in/tiwariaayush",
    initials: "AT"
  },
  {
    name: "Rishabh Agrawal",
    role: "Full Stack Developer",
    image: "/Rishabh.jpeg",
    github: "https://github.com/Rishcode",
    linkedin: "https://www.linkedin.com/in/rishabhaagrawal/",
    initials: "RA"
  },
  {
    name: "Archi Jain",
    role: "Full Stack Developer",
    image: "/Archi.jpeg",
    github: "https://github.com/archijain23",
    linkedin: "http://www.linkedin.com/in/jainarchi",
    initials: "AJ"
  }
];

const About = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header */}
        <div className="space-y-6 text-center">
          <Link to="/">
            <Button variant="ghost" className="absolute top-6 left-6 text-slate-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            <span className="text-cyan-400">About</span> <span className="text-purple-400">Word Traitor</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            A social deduction game designed to test your trust, deception, and word association skills.
          </p>
        </div>

        {/* Mission Section */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-400">
                <Code2 className="h-5 w-5" /> The Mission
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 leading-relaxed">
              We wanted to create a game that brings people together through tension and laughter. 
              Word Traitor challenges players to blend in while standing out, creating unforgettable 
              moments of betrayal and discovery.
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <HelpCircle className="h-5 w-5" /> How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 space-y-2">
              <ul className="list-disc list-inside space-y-1">
                <li><span className="text-white font-medium">Civilian:</span> Has the secret word. Blend in.</li>
                <li><span className="text-white font-medium">Traitor:</span> Has no word. Guess it or lie.</li>
                <li><span className="text-white font-medium">Discussion:</span> Vote out the suspicious player.</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Developers Section */}
        <div className="space-y-8">
          <div className="flex items-center justify-center gap-2 text-2xl font-semibold text-slate-200">
            <Users className="h-6 w-6 text-cyan-400" />
            <h2>Meet the Developers</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {developers.map((dev, index) => (
              <Card key={index} className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/50 transition-all duration-300 group">
                <CardHeader className="text-center">
                  <Avatar className="h-20 w-20 mx-auto mb-4 border-2 border-slate-700 group-hover:border-cyan-400 transition-colors">
                    <AvatarImage src={dev.image} />
                    <AvatarFallback className="bg-slate-800 text-cyan-400 text-xl font-bold">
                      {dev.initials}
                    </AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-white">{dev.name}</CardTitle>
                  <CardDescription className="text-cyan-400/80">{dev.role}</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center gap-4">
                  <a href={dev.github} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="ghost" className="hover:text-white hover:bg-slate-800">
                      <Github className="h-5 w-5" />
                    </Button>
                  </a>
                  <a href={dev.linkedin} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="ghost" className="hover:text-cyan-400 hover:bg-slate-800">
                      <Linkedin className="h-5 w-5" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-600 text-sm pt-12 border-t border-slate-800/50">
          <p>© {new Date().getFullYear()} Word Traitor. Open Source Project.</p>
        </div>

      </div>
    </div>
  );
};

export default About;
