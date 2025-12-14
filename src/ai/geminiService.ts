import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { Clip, ClipType } from "../../types";
import { v4 as uuidv4 } from 'uuid';

const TOOL_BUILD_PATCH: FunctionDeclaration = {
  name: "buildPatchFromPrompt",
  description: "Creates a visual generator patch based on a user description.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      generatorType: {
        type: Type.STRING,
        description: "The type of generator algorithm.",
        enum: ["smoke", "voronoi", "scanline"]
      },
      params: {
        type: Type.OBJECT,
        description: "Parameters for the generator",
        properties: {
          speed: { type: Type.NUMBER, description: "Speed of animation 0.0-5.0" },
          density: { type: Type.NUMBER, description: "Density/Intensity 0.0-1.0" }
        }
      },
      name: { type: Type.STRING, description: "A creative name for this patch" }
    },
    required: ["generatorType", "name"]
  }
};

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private modelId = 'gemini-2.5-flash';

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generatePatch(prompt: string): Promise<Partial<Clip> | null> {
    if (!this.ai) throw new Error("AI not initialized");

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelId,
        contents: prompt,
        config: {
          tools: [{ functionDeclarations: [TOOL_BUILD_PATCH] }],
          systemInstruction: "You are an expert VJ. Map abstract concepts to these generators: 'smoke' (ethereal, fluid), 'voronoi' (organic, cellular, biology), 'scanline' (tech, glitch, retro). Default to smoke if unsure.",
        }
      });

      const call = response.functionCalls?.[0];
      
      if (call && call.name === 'buildPatchFromPrompt') {
        const args = call.args as any;
        
        const newClip: Partial<Clip> = {
            id: uuidv4(),
            name: args.name || 'AI Patch',
            type: ClipType.GENERATOR,
            generatorId: args.generatorType,
            active: false,
            params: [
                { id: uuidv4(), name: 'Speed', value: args.params?.speed || 1.0, min: 0, max: 5 },
                { id: uuidv4(), name: 'Density', value: args.params?.density || 0.5, min: 0, max: 1 }
            ]
        };
        return newClip;
      }
      
      return null;
    } catch (e) {
      console.error("Gemini Error:", e);
      return null;
    }
  }
}
