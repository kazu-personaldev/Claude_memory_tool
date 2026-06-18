import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  let body: { content?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { content, apiKey } = body;
  const key = process.env.ANTHROPIC_API_KEY ?? apiKey;

  if (!key) {
    return NextResponse.json(
      { error: 'API Keyが設定されていません。画面上部でAPIキーを入力してください。' },
      { status: 401 }
    );
  }

  if (!content?.trim()) {
    return NextResponse.json({ error: 'メッセージが空です' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: key });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      messages: [{ role: 'user', content: content.trim() }],
    });

    const response =
      message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({ response });
  } catch (err) {
    const error = err as { status?: number; message?: string; error?: { type?: string } };

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'レート制限中です。しばらくしてから再試行します。', retryAfterSeconds: 300 },
        { status: 429 }
      );
    }
    if (error.status === 529) {
      return NextResponse.json(
        { error: 'Claudeが混雑しています。しばらくしてから再試行します。', retryAfterSeconds: 120 },
        { status: 529 }
      );
    }
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'APIキーが無効です。正しいキーを入力してください。' },
        { status: 401 }
      );
    }
    if (error.status === 402) {
      return NextResponse.json(
        { error: 'APIクレジットが不足しています。Anthropicアカウントにクレジットを追加してください。' },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: error.message ?? '不明なエラーが発生しました' },
      { status: 500 }
    );
  }
}
