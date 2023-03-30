"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bolt_1 = require("@slack/bolt");
const sheets_api_1 = require("./sheets-api");
const open_ai_api_1 = require("./open-ai-api");
const express_1 = __importDefault(require("express"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const environment = process.env.SLACK_APP_ENV;
const port = process.env.PORT;
const slackBotToken = process.env.SLACK_BOT_TOKEN;
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackAppToken = process.env.SLACK_APP_TOKEN;
let app;
if (environment === "development") {
    // 開発環境の場合は socketMode で起動する
    app = new bolt_1.App({
        token: slackBotToken,
        signingSecret: slackSigningSecret,
        socketMode: true,
        appToken: slackAppToken,
        port: 3000,
    });
}
else {
    // 本番環境は httpMode で起動する
    const receiver = new bolt_1.ExpressReceiver({ signingSecret: slackSigningSecret || "" });
    receiver.app.use(express_1.default.json());
    receiver.app.get('/', (_req, res) => {
        console.log("hello world");
        res.send('Hello World!');
    });
    // Renderからのヘルスチェック用
    receiver.app.get('/healthcheck', (_req, res) => {
        res.send('OK!');
    });
    // Slack appからの疎通確認用
    receiver.app.post('/slack/events', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        console.log(req);
        if (req.body.type === 'url_verification') {
            res.status(200).send(req.body.challenge);
        }
        else {
            res.status(404).end();
        }
    }));
    app = new bolt_1.App({
        token: slackBotToken,
        appToken: slackAppToken,
        receiver
    });
}
app.event('app_mention', ({ event, client, say }) => __awaiter(void 0, void 0, void 0, function* () {
    const channelId = event.channel;
    const userId = event.user;
    const text = event.text;
    const botUserId = process.env.BOT_USER_ID;
    const timestamp = event.ts;
    try {
        /* 応答があったスレッドの内容を取得 */
        const replies = yield client.conversations.replies({
            channel: channelId,
            ts: event.thread_ts || event.ts,
        });
        // チャンネル名を取得
        const channelInfoResponse = yield client.conversations.info({ channel: channelId });
        let channelName = '';
        if (channelInfoResponse.channel) {
            channelName = channelInfoResponse.channel.name || 'Unknown channel';
        }
        else {
            channelName = 'Unknown channel';
        }
        // ユーザー名を取得
        const userInfoResponse = yield client.users.info({ user: userId || '' });
        let userName = '';
        if (userInfoResponse.user) {
            userName = userInfoResponse.user.real_name || userInfoResponse.user.name;
        }
        else {
            userName = 'Unknown user';
        }
        // 投稿内容からChatGPTメンションを削除する
        const cleanedText = text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();
        // 投稿時間タイムスタンプ（秒単位）をDateオブジェクトに変換
        const postedDateUTC = new Date(parseInt(timestamp) * 1000);
        const postedDateJST = new Date(postedDateUTC.getTime() + 9 * 60 * 60 * 1000);
        console.log('===replies===========================');
        console.log(replies);
        console.log('===replies===========================');
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
            yield say('[ERROR]:\nスレッドが見つかりませんでした。\n管理者に連絡してください。');
            return;
        }
        /* スレッドの内容をGTPに送信 */
        const threadMessages = replies.messages.map((message) => {
            return {
                role: message.user === botUserId ? 'assistant' : 'user',
                content: (message.text || '').replace(`<@${botUserId}> `, ''),
            };
        });
        console.log('===threadMessages===========================');
        console.log(threadMessages);
        console.log('===threadMessages===========================');
        const gptAnswerText = yield (0, open_ai_api_1.postChat)(threadMessages);
        console.log('===AnswerText===========================');
        console.log(gptAnswerText);
        console.log('===AnswerText===========================');
        /* 投稿内容をスプレッドシートに保存 */
        const values = [
            [channelName, userName, cleanedText, gptAnswerText, postedDateJST.toISOString()],
        ];
        yield (0, sheets_api_1.appendToSheet)(values);
        /* スレッドに返信 */
        yield say({
            text: gptAnswerText,
            thread_ts: event.ts,
        });
    }
    catch (error) {
        console.error(error);
    }
}));
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield app.start(port || 3000);
    console.log('⚡️ Bolt app is running!');
}))();
