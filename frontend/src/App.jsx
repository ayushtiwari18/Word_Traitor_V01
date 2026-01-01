import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Lobby from "./pages/Lobby";
import Whisper from "./pages/Whisper";
import HintDrop from "./pages/HintDrop";
import Discussion from "./pages/Discussion";
import Game from "./pages/Game";
// import Results from "./pages/Results";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import FeedbackWidget from "@/components/FeedbackWidget";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/lobby/:roomCode" element={<Lobby />} />

          <Route path="/word/:roomCode" element={<Whisper />} />
          <Route path="/hint/:roomCode" element={<HintDrop />} />
          <Route path="/discussion/:roomCode" element={<Discussion />} />

          <Route path="/game" element={<Game />} />
          {/* <Route path="/results" element={<Results />} /> */}
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/help" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <FeedbackWidget />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
