import { App, ExpressReceiver } from '@slack/bolt'
import { appendToSheet } from "./sheets-api";
import { postChat } from "./open-ai-api";
import express from 'express';
import { config } from 'dotenv';
config();

const environment: string | undefined = process.env.SLACK_APP_ENV;
const port : string | undefined = process.env.PORT
const slackBotToken: string | undefined = process.env.SLACK_BOT_TOKEN;
const slackSigningSecret: string | undefined = process.env.SLACK_SIGNING_SECRET;
const slackAppToken: string | undefined = process.env.SLACK_APP_TOKEN;

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
  const botUserId: string | undefined = process.env.BOT_USER_ID;
  const timestamp: string = event.ts;

  try {
    /* 応答があったスレッドの内容を取得 */
    const replies = await client.conversations.replies({
      channel: channelId,
      ts: event.thread_ts || event.ts,
    });

    // チャンネル名を取得
    const channelInfoResponse = await client.conversations.info({ channel: channelId });
    let channelName: string | undefined = '';
    if (channelInfoResponse.channel) {
      channelName = channelInfoResponse.channel.name || 'Unknown channel';
    } else {
      channelName = 'Unknown channel';
    }

    // ユーザー名を取得
    const userInfoResponse = await client.users.info({ user: userId || '' });
    let userName: string | undefined = '';
    if (userInfoResponse.user) {
      userName = userInfoResponse.user.real_name || userInfoResponse.user.name;
    } else {
      userName = 'Unknown user';
    }

    // 投稿内容からChatGPTメンションを削除する
    const cleanedText = text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();

    // 投稿時間タイムスタンプ（秒単位）をDateオブジェクトに変換
    const postedDateUTC = new Date(parseInt(timestamp) * 1000);
    const postedDateJST = new Date(postedDateUTC.getTime() + 9 * 60 * 60 * 1000);

    console.log('===replies===========================')
    console.log(replies)
    console.log('===replies===========================')
    console.log('===Channel Name==========================');
    console.log(channelName);
    console.log('===User Name============================');
    console.log(userName);
    console.log('===Text===============================');
    console.log(cleanedText);
    console.log('=======================================');
    console.log('===Posted Date========================');
    console.log(postedDateJST);
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

    /* 投稿内容をスプレッドシートに保存 */
    const values = [
      [channelName, userName, cleanedText, gptAnswerText, postedDateJST.toISOString()],
    ];
    await appendToSheet(values);

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
