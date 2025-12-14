import React, { useState } from 'react';
import { useStore } from '../model/store';
import { GeminiService } from '../ai/geminiService';
import { Sparkles, Send, Loader2 } from 'lucide-react';

export const Copilot: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { apiKey, setApiKey, addClip } = useStore();
  
  const handleSend = async () => {
      if (!input.trim() || !apiKey) return;
      setLoading(true);
      
      const service = new GeminiService(apiKey);
      const result = await service.generatePatch(input);
      
      if (result) {
          addClip('l1', result as any); // Add to Layer 1 for demo
          setInput('');
      } else {
          alert("Could not generate patch. Try a simpler prompt.");
      }
      setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800 w-80">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
            <Sparkles className="text-purple-400" size={18} />
            <h3 className="font-bold text-zinc-100">AETHER COPILOT</h3>
        </div>

        <div className="flex-1 p-4 overflow-y-auto text-sm text-zinc-400">
            {!apiKey ? (
                <div className="bg-red-900/20 border border-red-800 p-3 rounded text-red-200">
                    <p className="mb-2">API Key Required for AI features.</p>
                    <input 
                        type="password" 
                        placeholder="Enter Gemini API Key"
                        className="w-full bg-zinc-950 border border-zinc-700 p-2 rounded text-white"
                        onChange={(e) => setApiKey(e.target.value)}
                    />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-zinc-800 p-3 rounded-lg rounded-tl-none">
                        Hello. Describe a visual style (e.g., "Slow red smoke with high density"), and I will build a generative patch for you.
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
            <div className="flex gap-2">
                <input
                    type="text"
                    disabled={!apiKey || loading}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={loading ? "Generating..." : "Describe visuals..."}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
                <button 
                    onClick={handleSend}
                    disabled={!apiKey || loading}
                    className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                </button>
            </div>
        </div>
    </div>
  );
};