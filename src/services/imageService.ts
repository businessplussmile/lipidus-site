import { GoogleGenAI } from "@google/genai";

export async function generateLipidusImages() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = "gemini-2.5-flash-image";

  const prompts = [
    "A professional waste collector, a Black Ivorian man, wearing a green work uniform with 'LIPIDUS' clearly written on the chest. He is working in a modern residential courtyard in Abidjan, Côte d'Ivoire. High quality, realistic photography.",
    "A group of smiling young Black Ivorian men and women, wearing clean white t-shirts with 'LIPIDUS' written on them. They look professional and friendly, standing in a sunny street in Abidjan. High quality, realistic photography.",
    "A Black Ivorian man sitting on a green motorized tricycle (moto-tricycle) designed for waste collection. The back of the tricycle is filled with neatly packed trash bags. He is on a street in Abidjan. High quality, realistic photography."
  ];

  const results = [];
  for (const prompt of prompts) {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        results.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }
  }
  return results;
}
