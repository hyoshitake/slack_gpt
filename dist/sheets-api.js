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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendToSheet = void 0;
const googleapis_1 = require("googleapis");
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || "";
const privateKey = ((_a = process.env.GOOGLE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n')) || "";
const spreadsheetId = process.env.SPREAD_SHEET_ID;
const auth = new googleapis_1.google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheetsApi = googleapis_1.google.sheets({ version: "v4", auth });
// スプレッドシートの最終行に記録を追加する
function appendToSheet(values) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 最終行を取得して挿入する行を決定する
            const lastRow = yield getLastRow(spreadsheetId || "");
            const range = `シート1!A${lastRow}:E${lastRow}`;
            // Google API を呼び出してスプレッドシートに引数の値を書き込む
            yield sheetsApi.spreadsheets.values.append({
                spreadsheetId,
                range,
                valueInputOption: "RAW",
                insertDataOption: "INSERT_ROWS",
                requestBody: {
                    values,
                },
            });
            console.log("スプレッドシートへの書き込みが完了しました");
        }
        catch (error) {
            console.error("スプレッドシートへの書き込みが失敗しました: ", error);
        }
    });
}
exports.appendToSheet = appendToSheet;
// スプレッドシートの最終行の取得
function getLastRow(spreadsheetId) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield sheetsApi.spreadsheets.values.get({
            spreadsheetId,
            range: `シート1!A1:E1`,
        });
        return response.data.values ? response.data.values.length + 1 : 1;
    });
}
