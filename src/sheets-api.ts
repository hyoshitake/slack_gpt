import { JWT } from "google-auth-library";
import { sheets_v4 } from "@googleapis/sheets";

const clientEmail: string | undefined = process.env.GOOGLE_CLIENT_EMAIL || "";
const privateKey: string | undefined = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "";
const spreadsheetId: string | undefined = process.env.SPREAD_SHEET_ID;

const auth = new JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheetsApi = new sheets_v4.Sheets({ auth });

// スプレッドシートの最終行に記録を追加する
export async function appendToSheet(values: any[][]) {
  try {
    // 最終行を取得して挿入する行を決定する
    const lastRow = await getLastRow(spreadsheetId || "");
    const range = `シート1!A${lastRow}:E${lastRow}`;

    // Google API を呼び出してスプレッドシートに引数の値を書き込む
    await sheetsApi.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });
    console.log("スプレッドシートへの書き込みが完了しました");
  } catch (error) {
    console.error("スプレッドシートへの書き込みが失敗しました: ", error);
  }
}

// スプレッドシートの最終行の取得
async function getLastRow(spreadsheetId: string) {
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `シート1!A1:E1`,
  });
  return response.data.values ? response.data.values.length + 1 : 1;
}