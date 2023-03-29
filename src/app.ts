import { App, MessageEvent, ExpressReceiver } from '@slack/bolt'
import axios from 'axios';
import express from 'express';
import { config } from 'dotenv';
config();

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

const environment: string | undefined = process.env.SLACK_APP_ENV;
const port : string | undefined = process.env.PORT
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

let app;
if (environment === "development") {
  // 開発環境の場合は socketMode で起動する
  app = new App({
    token: slackBotToken,
    signingSecret: slackSigningSecret,
    socketMode: true,
    appToken: slackAppToken,
    port: 3000,
  });
} else {
  // 本番環境は httpMode で起動する
  const receiver = new ExpressReceiver({ signingSecret: slackSigningSecret || "" });
  receiver.app.use(express.json());
  receiver.app.get('/', (_req, res) => {
    console.log("hello world")
    res.send('Hello World!');
  });
  // Renderからのヘルスチェック用
  receiver.app.get('/healthcheck', (_req, res) => {
    res.send('OK!');
  });
  // Slack appからの疎通確認用
  receiver.app.post('/slack/events', async (req, res) => {
    console.log(req)
    if (req.body.type === 'url_verification') {
      res.status(200).send(req.body.challenge);
    } else {
      res.status(404).end();
    }
  });
  app = new App({
    token: slackBotToken,
    appToken: slackAppToken,
    receiver
  });
}

app.event('app_mention', async ({ event, client, say }) => {
  const channelId: string = event.channel;
  const userId: string | undefined = event.user;
  const text: string = event.text;
  const botUserId: string | undefined = process.env.BOT_USER_ID

  try {
    /* 応答があったスレッドの内容を取得 */
    const replies = await client.conversations.replies({
      channel: channelId,
      ts: event.thread_ts || event.ts,
    });
    // ユーザー情報を取得
    const userInfoResponse = await client.users.info({ user: userId || '' });
    let userName: string | undefined = '';

    if (userInfoResponse.user) {
      userName = userInfoResponse.user.real_name || userInfoResponse.user.name;
    } else {
      userName = 'Unknown user';
    }

    // チャンネル情報を取得
    const channelInfoResponse = await client.conversations.info({ channel: channelId });
    let channelName: string | undefined = '';

    if (channelInfoResponse.channel) {
      channelName = channelInfoResponse.channel.name || 'Unknown channel';
    } else {
      channelName = 'Unknown channel';
    }

    // 投稿内容からChatGPTメンションを削除する
    const cleanedText = text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();

    console.log('===replies===========================')
    console.log(replies)
    console.log('===replies===========================')
    console.log('===User Name============================');
    console.log(userName);
    console.log('===Channel Name==========================');
    console.log(channelName);
    console.log('===Text===============================');
    console.log(cleanedText);
    console.log('=======================================');

    if (!replies.messages) {
      await say(
        '[ERROR]:\nスレッドが見つかりませんでした。\n管理者に連絡してください。',
      );

      return;
    }

    /* スレッドの内容をGTPに送信 */
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
  await app.start(port || 3000);

  console.log('⚡️ Bolt app is running!');
})();
