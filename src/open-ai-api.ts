import axios from 'axios';

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
const openAiApiKey: string | undefined = process.env.OPEN_AI_API_KEY;

// OpenAIにAPIリクエストを送る
export async function postChat (messages: openAiMessage[]) {

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