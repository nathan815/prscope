import type { IncomingMessage, ServerResponse } from "http";

export async function handleLLMChatRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("POST only");
    return;
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk as Uint8Array);
  const body = JSON.parse(Buffer.concat(chunks).toString()) as {
    messages: { role: string; content: string }[];
    model?: string;
  };

  try {
    const { CopilotClient, approveAll } = await import("@github/copilot-sdk");
    const client = new CopilotClient();
    await client.start();

    const session = await client.createSession({
      onPermissionRequest: approveAll,
      ...(body.model ? { model: body.model } : {}),
    });

    const prompt = body.messages.map((m) => m.content).join("\n\n");
    const result = await session.sendAndWait({ prompt });

    await client.stop();

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        model: "GitHub Copilot",
        choices: [
          {
            message: {
              role: "assistant",
              content: result?.data?.content ?? "",
            },
          },
        ],
      }),
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error:
          "Copilot LLM call failed. Ensure you have a Copilot subscription and are logged in.",
        details: String(err),
      }),
    );
  }
}
