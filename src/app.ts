import { App, MessageEvent } from '@slack/bolt'

import axios from 'axios';
import { config } from 'dotenv';
config();

// userが型定義されていないと怒られるため、string型のuserを持ったOriginalMessageEventをMessageEventを拡張して再定義する
type OriginalMessageEvent = MessageEvent & {
  user: string;
};

// OpenAIへのリクエストのインターフェース もっと色々設定できるが今回必要なもののみ定義
interface ChatCompletionRequestBody {
  model: string;
  messages: openAiMessage[];
}

// OpenAIへのリクエストに使用されるmessageの詳細
interface openAiMessage {
  role: string;
  content: string;
}

// OpenAIのレスポンスのインターフェース 返却されるレスポンス詳細をもっと色々設定できるが今回必要なもののみ定義
interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    }
  }[];
}

const environment: string | undefined = process.env.ENV;
const slackBotToken: string | undefined = process.env.SLACK_BOT_TOKEN;
const slackSigningSecret: string | undefined = process.env.SLACK_SIGNING_SECRET;
const slackAppToken: string | undefined = process.env.SLACK_APP_TOKEN

const postChat = async (messages: openAiMessage[]): Promise<string> => {

  const openAiApiKey: string | undefined = process.env.OPEN_AI_API_KEY;
  if (!openAiApiKey) {
    throw new Error('OpenAI API key not found');
  }

  const endpoint = 'https://api.openai.com/v1/chat/completions';
  const requestBody: ChatCompletionRequestBody = {
    model: 'gpt-3.5-turbo',
    messages: messages,
  };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${openAiApiKey}`
  };

  const response = await axios.post<ChatCompletionResponse>(endpoint, requestBody, {
    headers,
    timeout: 20000
  });

  if (!response.data) return 'No response from OpenAI API';

  return response.data.choices[0].message.content;
};

const appOptions = {
  token: slackBotToken,
  signingSecret: slackSigningSecret,
  socketMode: false,
  appToken: slackAppToken,
  port: 3000
}

if (environment === "development") {
  // 開発環境の場合は socketMode で起動する
  appOptions["socketMode"] = true;
}

const app = new App(appOptions);

// "hello" を含むメッセージをリッスンします
app.message('hello', async ({ message, say }) => {
  const originalMessage: OriginalMessageEvent = message as OriginalMessageEvent;
  // イベントがトリガーされたチャンネルに say() でメッセージを送信します
  await say(`Hey there <@${originalMessage.user}>!`);
});

app.event('app_mention', async ({ event, client, say }) => {
  const channelId: string = event.channel;
  // if (channelId !== askBotChannelId) return;
  try {
    /* 応答があったスレッドの内容を取得 */
    const replies = await client.conversations.replies({
      channel: channelId,
      ts: event.thread_ts || event.ts,
    });
    console.log('===replies===========================')
    console.log(replies)
    console.log('===replies===========================')

    if (!replies.messages) {
      await say(
        '[ERROR]:\nスレッドが見つかりませんでした。\n管理者に連絡してください。',
      );

      return;
    }

    /* スレッドの内容をGTPに送信 */
    const botUserId: string | undefined = process.env.BOT_USER_ID
    const threadMessages = replies.messages.map((message) => {
      return {
        role: message.user === botUserId ? 'assistant' : 'user',
        content: (message.text || '').replace(`<@${botUserId}> `, ''),
      };
    });
    console.log('===threadMessages===========================')
    console.log(threadMessages)
    console.log('===threadMessages===========================')
    const gptAnswerText = await postChat(threadMessages);
    console.log('===AnswerText===========================')
    console.log(gptAnswerText)
    console.log('===AnswerText===========================')

    /* スレッドに返信 */
    await say({
      text: gptAnswerText,
      thread_ts: event.ts,
    });
  } catch (error) {
    console.error(error);
  }
});

(async () => {
  // アプリを起動します
  await app.start();

  console.log('⚡️ Bolt app is running!');
})();
