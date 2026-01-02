import { useState, useEffect } from "react";
import { MessageSquare, Star, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";

const FeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setRating(0);
      setMessage("");
    }
  }, [isOpen]);

  const getProfileId = () => {
    // 1. Try to get from location state (most accurate during game)
    if (location.state?.profileId) return location.state.profileId;

    // 2. Fallback: Search localStorage for any stored profile_id
    // Keys are stored as "profile_id_ROOMCODE"
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("profile_id_")) {
          return localStorage.getItem(key);
        }
      }
    } catch (e) {
      console.warn("Error accessing localStorage", e);
    }
    return null;
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating star.");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a message.");
      return;
    }

    setIsSubmitting(true);
    const userId = getProfileId();

    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: userId, // Can be null if generic feedback
        message: message.trim(),
        rating: rating,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Feedback sent! Thank you.");
      setIsOpen(false);
    } catch (error) {
      console.error("Feedback error:", error);
      toast.error("Failed to send feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          id="feedback-trigger"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg shadow-cyan-500/20 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 border-0 p-0 animate-in fade-in zoom-in duration-300"
          size="icon"
        >
          <MessageSquare className="h-6 w-6 text-white" />
          <span className="sr-only">Send Feedback</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-slate-900/95 backdrop-blur-xl border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-cyan-400" />
            Send Feedback
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Found a bug or have a suggestion? Let us know!
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              How was your experience?
            </label>
            <div className="flex gap-2 justify-center p-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`p-1 transition-all hover:scale-110 focus:outline-none ${
                    rating >= star
                      ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                      : "text-slate-600 hover:text-slate-500"
                  }`}
                  type="button"
                >
                  <Star
                    className={`h-8 w-8 ${
                      rating >= star ? "fill-current" : ""
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="message"
              className="text-sm font-medium text-slate-300"
            >
              Your Message
            </label>
            <Textarea
              id="message"
              placeholder="Tell us what you think..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:justify-end gap-2">
           <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackWidget;
