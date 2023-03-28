FROM node:14

WORKDIR /app

COPY package*.json ./

RUN npm ci

# TypeScriptをローカルにインストールし、PATHに追加する
RUN npm install typescript tsc-watch && \
    ln -s /app/node_modules/.bin/tsc /usr/local/bin/tsc && \
    ln -s /app/node_modules/.bin/tsc-watch /usr/local/bin/tsc-watch

COPY . .

# TypeSciprtをビルドしてjsファイルを作成する
RUN tsc --project .

# tsc-watchで監視しながらnpm startを実行する
CMD ["npm", "run", "watch"]