// const { App } = require('@slack/bolt');
// const { postChat } = require('@/chat_gpt.ts');

// import { App } from '@slack/bolt';
// const postChat = require("./chat_gpt");
// import postChat from "./chat_gpt";
// import { postChat } from "./chatGpt";

import pkg from '@slack/bolt';
const { App } = pkg;

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const postChat = async (messages) => {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages,
    }, // body
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    },
  );

  if (!response.data) return 'No response from OpenAI API';

  return response.data.choices[0].message.content;
};

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  // ソケットモードではポートをリッスンしませんが、アプリを OAuth フローに対応させる場合、
  // 何らかのポートをリッスンする必要があります
  port: 3000
});

// "hello" を含むメッセージをリッスンします
app.message('hello', async ({ message, say }) => {
  // イベントがトリガーされたチャンネルに say() でメッセージを送信します
  await say(`Hey there <@${message.user}>!`);
});

app.event('app_mention', async ({ event, client, say }) => {
  const channelId = event.channel;
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
    const threadMessages = replies.messages.map((message) => {
      return {
        // role: message.user === botUserId ? 'assistant' : 'user',
        role: 'user',
        // content: (message.text || '').replace(`<@${botUserId}>`, ''),
        content: (message.text || ''),
      };
    });
    console.log('===replies===========================')
    console.log(threadMessages)
    console.log('===replies===========================')
    const gptAnswerText = await postChat(threadMessages);
    console.log('===replies===========================')
    console.log(gptAnswerText)
    console.log('===replies===========================')

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
