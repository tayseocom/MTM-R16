import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function FAQDialog() {
  const faqs = [
    {
      question: "How do I set the MIDI clock BPM (tempo)?",
      answer: "Click the TEMPO button, then use the number pad (1-9, 0) to enter the desired BPM value. The tempo range is 40-250 BPM. The current tempo is always displayed on the LCD screen."
    },
    {
      question: "How do I record MIDI data?",
      answer: "1. Select tracks to record by clicking track buttons (1-16)\n2. Click the RECORD button (red circle)\n3. Wait for the 2-second count-in\n4. Play your MIDI keyboard/controller\n5. Click STOP when finished\nYour performance will be automatically saved to localStorage."
    },
    {
      question: "How do I play back my recordings?",
      answer: "Select the tracks you want to hear by clicking their track buttons, then press PLAY. The sequencer will loop the current part continuously until you press STOP."
    },
    {
      question: "What is quantize and how do I use it?",
      answer: "Quantize corrects timing by snapping notes to the nearest grid division. Press QUANTIZE, then select:\n• 1 = 1/4 note (quarter note)\n• 2 = 1/8 note (eighth note)\n• 3 = 1/16 note (sixteenth note)\n• 4 = 1/32 note (thirty-second note)\n• 0 = Off (no quantization)"
    },
    {
      question: "How do I change the part length?",
      answer: "Press the LENGTH button, then use the number pad to enter the number of bars (measures) for the current part. Default is 4 bars."
    },
    {
      question: "How do I switch between parts?",
      answer: "Press the PART button, then press a number (1-9, 0=10) to select a part. The MTM-R16 has 16 parts total, each with 16 tracks."
    },
    {
      question: "How do I copy a part to another location?",
      answer: "1. Press COPY button\n2. Press the source part number\n3. Press the destination part number\nThe entire part (all 16 tracks) will be copied."
    },
    {
      question: "How do I merge two tracks together?",
      answer: "1. Press MERGE button\n2. Click the source track button\n3. Click the destination track button\nBoth tracks' MIDI events will be combined in the destination track."
    },
    {
      question: "How do I erase a track or part?",
      answer: "1. Select the track(s) you want to erase\n2. Press ERASE button\n3. Press the track button again to confirm\nThis will delete all MIDI data from the selected track(s)."
    },
    {
      question: "How do I transpose notes?",
      answer: "1. Select the track to transpose\n2. Press TRANSPOSE button\n3. Use number pad to enter semitones (+12 max, -12 min)\nNotes will shift up or down while staying within MIDI range (0-127)."
    },
    {
      question: "How do I save my project?",
      answer: "Projects automatically save to your browser's localStorage after recording. To export as a JSON file:\n1. Press SAVE button\n2. The project downloads as 'mtm-project.json'\nYou can reload it later by uploading the file."
    },
    {
      question: "How do I load a saved project?",
      answer: "Press the LOAD button and select a previously saved JSON project file from your computer. The project will replace your current session."
    },
    {
      question: "Why does it say 'NO MIDI - DEMO MODE'?",
      answer: "The Web MIDI API is only available in:\n• Chrome or Edge browsers\n• Secure context (HTTPS or localhost)\n• With physical MIDI devices connected\n• After granting MIDI permissions\n\nThe Replit preview shows the UI but requires deployment to a production URL for full MIDI functionality."
    },
    {
      question: "What are the track indicators showing?",
      answer: "• RED LED = Track is armed for recording\n• GREEN LED = Track is playing back\n• AMBER/ORANGE LED = Track has recorded data\n• Off = Empty track"
    },
    {
      question: "Can I overdub on existing tracks?",
      answer: "Yes! New recordings are appended to existing track data, not replaced. This allows you to build up complex patterns by recording multiple passes."
    },
    {
      question: "What MIDI channels do the tracks use?",
      answer: "By default, Track 1 = MIDI Channel 1, Track 2 = MIDI Channel 2, etc. (1-16). Use the MIDI CHAN button to reassign channels."
    },
    {
      question: "What keyboard shortcuts are available?",
      answer: "Transport Controls:\n\u2022 Space = Play / Stop\n\u2022 R = Record\n\u2022 Escape = Stop\n\nNavigation:\n\u2022 1-9, 0 = Select Part 1-10\n\u2022 [ = Rewind (bar 1, or previous song step)\n\u2022 ] = Forward (next bar, or next song step)\n\nEditing:\n\u2022 Ctrl+Z = Undo\n\u2022 Ctrl+Shift+Z or Ctrl+Y = Redo\n\nTracks:\n\u2022 Double-click a track button to rename it"
    },
    {
      question: "What does MIDI ECHO do?",
      answer: "MIDI ECHO (also called MIDI Thru) routes incoming MIDI directly to the output. When enabled (green LED), you can hear what you're playing on your synthesizer in real-time, even when not recording. This is essential for monitoring while recording."
    },
    {
      question: "How does MIDI Clock work?",
      answer: "Click the CLOCK button to cycle through modes:\n• OFF: No MIDI clock (default)\n• SEND (green LED): MTM-R16 sends MIDI clock to sync external devices like drum machines\n• RECEIVE (amber LED): MTM-R16 syncs to incoming MIDI clock from external master\n\nMIDI clock runs at 24 pulses per quarter note (ppqn) and allows multiple devices to stay in perfect sync."
    }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="toggle-elevate"
          data-testid="button-help"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">MTM-R16 MIDI Sequencer FAQ</DialogTitle>
          <DialogDescription>
            Common questions and answers about using the sequencer
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="space-y-2">
                <h3 className="font-semibold text-base">
                  {faq.question}
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
