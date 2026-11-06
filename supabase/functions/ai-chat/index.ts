// Project Evermore – AI replies for the in-game phone chat.
//
// The game sends her message, the recent chat and a short summary of what's happening in the game; this function
// adds the "how he talks" instructions and asks Groq. The Groq key lives only here, as a secret (GROQ_API_KEY).
// Only signed-in players can call it (sign-ups are disabled, so that's just the two of you), and each person gets a
// daily allowance counted in public.ai_usage (see supabase/migrations/20261107000000_ai_chat.sql).
//
// Secrets:  GROQ_API_KEY (required) · GROQ_MODEL (default llama-3.3-70b-versatile) · AI_DAILY_CAP (default 50)

import { withSupabase } from 'npm:@supabase/server@1';

const MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
const CAP = Number(Deno.env.get('AI_DAILY_CAP') ?? 50);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

interface ChatMsg { role: 'user' | 'assistant'; content: string }
/** him = the one replying (the partner in the game), her = the one playing. partnerIs flips the words if he plays. */
interface Payload { messages: ChatMsg[]; context: string; him: string; her: string; partnerIs: 'boyfriend' | 'girlfriend' }

function clean(raw: unknown): Payload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const msgs = Array.isArray(r.messages) ? r.messages : [];
  const messages = msgs.slice(-16).map((m) => {
    const o = (m ?? {}) as Record<string, unknown>;
    return { role: o.role === 'assistant' ? 'assistant' : 'user', content: str(o.content, 400) } as ChatMsg;
  }).filter((m) => m.content.trim());
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  return { messages, context: str(r.context, 2500), him: str(r.him, 40) || 'him', her: str(r.her, 40) || 'her', partnerIs: r.partnerIs === 'girlfriend' ? 'girlfriend' : 'boyfriend' };
}

function systemPrompt(p: Payload): string {
  const me = p.partnerIs, them = p.partnerIs === 'boyfriend' ? 'girlfriend' : 'boyfriend';
  return [
    `You are ${p.him}, texting your ${them} ${p.her} inside a cozy little game made as a gift for her.`,
    `Write exactly like a loving ${me} texting: short (usually 1–2 sentences, at most 3), warm, playful, a little teasing,`,
    `casual punctuation, an occasional emoji or ♡ but not every message. Answer what ${p.her} actually said; sometimes ask about ${p.her}'s day.`,
    'Use what is happening in the game (below) naturally when it fits; never list facts or sound like an assistant.',
    'Keep it sweet and wholesome: no explicit content, nothing hurtful, no promises about real-life plans, money or meeting times.',
    `If ${p.her} seems sad or stressed, be gentle and supportive. If ${p.her} ever talks about being in danger or wanting to self-harm,`,
    `kindly urge ${p.her} to reach out to the real ${p.him} and someone they trust right away.`,
    `If you are sincerely asked whether this is really ${p.him} or an AI, be honest and gentle: you are the game's version of ${p.him},`,
    `written to sound like ${p.him}, and the real ${p.him} loves ${p.her}. Otherwise just stay in character.`,
    '',
    'What is happening in the game right now:',
    p.context || '(nothing special)',
  ].join('\n');
}

const handler = withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return json({ error: 'not-configured' }, 503);
  const userId = ctx.userClaims?.sub as string | undefined;
  if (!userId) return json({ error: 'auth' }, 401);
  const p = clean(await req.json().catch(() => null));
  if (!p) return json({ error: 'bad-request' }, 400);

  // One reply from today's allowance (counted on the server, so it can't be skipped).
  const { data: turn, error: turnErr } = await ctx.supabaseAdmin.rpc('ai_take_turn', { p_user: userId, p_cap: CAP });
  if (turnErr) return json({ error: 'usage' }, 500);
  if (turn === -1) return json({ error: 'cap' }, 429);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.9,
        max_tokens: 160,
        messages: [{ role: 'system', content: systemPrompt(p) }, ...p.messages],
      }),
    });
    if (!r.ok) return json({ error: 'upstream', status: r.status }, 502);
    const data = await r.json();
    const reply = String(data?.choices?.[0]?.message?.content ?? '').trim().slice(0, 600);
    if (!reply) return json({ error: 'empty' }, 502);
    return json({ reply, left: Math.max(0, CAP - Number(turn)) });
  } catch {
    return json({ error: 'timeout' }, 504);
  } finally {
    clearTimeout(timer);
  }
});

export default {
  fetch: (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : handler(req)),
};
