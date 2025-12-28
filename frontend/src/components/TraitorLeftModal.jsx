import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const TraitorLeftModal = ({ roomCode, playerName, isHost, profileId }) => {
  const navigate = useNavigate();

  const handleBackToLobby = async () => {
    // Reset room status back to waiting
    navigate(`/lobby/${roomCode}`, {
      state: { playerName, isHost, profileId },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-8 border border-red-500/30 shadow-2xl shadow-red-500/20 max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 border border-red-500/30 mb-6">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        <h2 className="text-3xl font-bold mb-3 text-white">
          Traitor Left the Game
        </h2>

        <p className="text-slate-400 mb-8">
          The traitor has abandoned the game. The round cannot continue.
        </p>

        <Button
          onClick={handleBackToLobby}
          className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold py-6 text-lg"
        >
          Back to Lobby
        </Button>
      </div>
    </div>
  );
};

export default TraitorLeftModal;
