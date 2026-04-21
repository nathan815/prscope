export async function callLLM(
  messages: { role: string; content: string }[],
): Promise<{ content: string; model: string }> {
  const res = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; details?: string };
    throw new Error(err.details ?? err.error ?? `LLM request failed: ${res.status}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
    model?: string;
  };

  return {
    content: data.choices[0]?.message.content ?? '',
    model: data.model ?? 'unknown',
  };
}
