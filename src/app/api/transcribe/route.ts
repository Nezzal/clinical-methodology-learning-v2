import { NextResponse } from 'next/server';
import { loadEnvLocal } from '@/utils/env';

loadEnvLocal();

function cleanOutputText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  // Supprimer tout fragment du prompt qui aurait pu être répété par le modèle
  cleaned = cleaned.replace(/Tu es un transcripteur[\s\S]*/gi, '');
  cleaned = cleaned.replace(/Transcris fidèlement[\s\S]*/gi, '');
  cleaned = cleaned.replace(/Fais particulièrement attention[\s\S]*/gi, '');
  cleaned = cleaned.replace(/Renvoie UNIQUEMENT[\s\S]*/gi, '');
  cleaned = cleaned.replace(/^["'«»\s]+|["'«»\s]+$/g, '');
  return cleaned.trim();
}

export async function POST(req: Request) {
  try {
    const { audio, mimeType } = await req.json();

    if (!audio) {
      return NextResponse.json({ error: "Aucun fichier audio fourni." }, { status: 400 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openrouterKey && !geminiKey && !groqKey && !openaiKey) {
      return NextResponse.json({ 
        error: "Clé API non configurée dans .env.local (OPENROUTER_API_KEY ou GEMINI_API_KEY requis)." 
      }, { status: 500 });
    }

    const systemInstructionText = "Tu es un transcripteur expert en recherche médicale et méthodologie clinique. Transcris fidèlement et exactement l'enregistrement audio en français. Vocabulaire spécifique : 'biais' (ex: biais de sélection, de confusion, d'information), 'cohorte', 'cas-témoins', 'STROBE', 'RECIF', 'odds ratio', 'p-value'. N'écris rien d'autre que la transcription exacte. Ne répète jamais ces consignes dans ta réponse.";
    
    const userPromptText = "Transcris cet enregistrement audio en français.";

    const format = mimeType?.includes('mp4') ? 'mp4' : mimeType?.includes('wav') ? 'wav' : 'webm';
    const actualMimeType = mimeType || 'audio/webm';

    // 1. Essai direct Gemini REST API si clé disponible
    if (geminiKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstructionText }]
            },
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: actualMimeType,
                      data: audio
                    }
                  },
                  { text: userPromptText }
                ]
              }
            ]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleanedText = cleanOutputText(rawText);
          if (cleanedText) return NextResponse.json({ text: cleanedText });
        }
      } catch (e) {
        console.warn("Échec transcription directe Gemini, tentative OpenRouter...", e);
      }
    }

    // 2. Essai OpenRouter
    if (openrouterKey) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://recif-methodoclinique.com',
            'X-Title': 'RECIF MethodoClinique'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: systemInstructionText
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'input_audio',
                    input_audio: {
                      data: audio,
                      format: format
                    }
                  },
                  {
                    type: 'text',
                    text: userPromptText
                  }
                ]
              }
            ]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.choices?.[0]?.message?.content || '';
          const cleanedText = cleanOutputText(rawText);
          if (cleanedText) return NextResponse.json({ text: cleanedText });
        } else {
          const errText = await res.text();
          console.warn("OpenRouter audio status:", res.status, errText);
        }
      } catch (e) {
        console.warn("Échec OpenRouter input_audio, tentative fallback...", e);
      }
    }

    // 3. Essai Whisper (via Groq ou OpenAI si présent)
    if (groqKey || openaiKey) {
      try {
        const audioBuffer = Buffer.from(audio, 'base64');
        const blob = new Blob([audioBuffer], { type: actualMimeType });
        const formData = new FormData();
        formData.append('file', blob, `audio.${format}`);
        formData.append('model', groqKey ? 'whisper-large-v3-turbo' : 'whisper-1');
        formData.append('language', 'fr');
        formData.append('prompt', "Recherche clinique, méthodologie, biais, cohorte, STROBE, RECIF, épidémiologie.");

        const endpoint = groqKey 
          ? 'https://api.groq.com/openai/v1/audio/transcriptions'
          : 'https://api.openai.com/v1/audio/transcriptions';
        const key = groqKey || openaiKey;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}` },
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          if (data.text) return NextResponse.json({ text: cleanOutputText(data.text) });
        }
      } catch (e) {
        console.warn("Échec Whisper API...", e);
      }
    }

    return NextResponse.json({ error: "Aucun service de transcription n'a pu traiter l'audio." }, { status: 500 });
  } catch (err: any) {
    console.error("Erreur API /api/transcribe:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur lors de la transcription" }, { status: 500 });
  }
}
