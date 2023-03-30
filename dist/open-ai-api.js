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
exports.postChat = void 0;
const axios_1 = __importDefault(require("axios"));
const openAiApiKey = process.env.OPEN_AI_API_KEY;
// OpenAIにAPIリクエストを送る
function postChat(messages) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!openAiApiKey) {
            throw new Error('OpenAI API key not found');
        }
        const endpoint = 'https://api.openai.com/v1/chat/completions';
        const requestBody = {
            model: 'gpt-3.5-turbo',
            messages: messages,
        };
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiApiKey}`
        };
        const response = yield axios_1.default.post(endpoint, requestBody, {
            headers,
            timeout: 20000
        });
        if (!response.data)
            return 'No response from OpenAI API';
        return response.data.choices[0].message.content;
    });
}
exports.postChat = postChat;
;
