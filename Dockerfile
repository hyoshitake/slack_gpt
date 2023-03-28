FROM node:14

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# TypeSciprtをビルドしてjsファイルを作成する
RUN npx tsc --project .

# tsc-watchで監視しながらnpm startを実行する
CMD ["npm", "run", "watch"]