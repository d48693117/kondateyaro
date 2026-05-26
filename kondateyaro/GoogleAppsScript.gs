/**
 * こんだて野郎 — Googleスプレッドシート連携スクリプト
 *
 * 【デプロイ手順】
 * 1. Googleスプレッドシートを新規作成（名前は何でもOK）
 * 2. メニュー「拡張機能」→「Apps Script」を開く
 * 3. このコードを全て貼り付けて保存
 * 4. 「デプロイ」→「新しいデプロイ」をクリック
 * 5. 種類：「ウェブアプリ」を選択
 * 6. 設定：
 *      説明：kondateyaro
 *      次のユーザーとして実行：自分
 *      アクセスできるユーザー：全員
 * 7. 「デプロイ」→Googleアカウントで認証
 * 8. 表示された「ウェブアプリのURL」をコピー
 * 9. アプリの「設定」タブの「GAS Web App URL」に貼り付ける
 *
 * 【認証トークンの設定（任意）】
 * スクリプトプロパティに TOKEN=好きな文字列 を設定すると
 * URLを知っていても認証なしではアクセスできなくなります
 * 設定方法: Apps Script の「プロジェクトの設定」→「スクリプトプロパティ」
 * プロパティ名: TOKEN  値: 好きな文字列
 */

/* ─── GET: データ取得 ─── */
function doGet(e) {
  try {
    const token = (e.parameter && e.parameter.token) ? e.parameter.token : "";
    const storedToken = PropertiesService.getScriptProperties().getProperty("TOKEN") || "";

    if (storedToken && token !== storedToken) {
      return jsonResponse({ error: "unauthorized" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss);
    const cellVal = sheet.getRange("A1").getValue();

    let data = null;
    if (cellVal) {
      try { data = JSON.parse(cellVal); } catch(e2) {}
    }

    return jsonResponse({ data });
  } catch(err) {
    return jsonResponse({ error: err.message });
  }
}

/* ─── POST: データ保存 ─── */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const token = body.token || "";
    const storedToken = PropertiesService.getScriptProperties().getProperty("TOKEN") || "";

    if (storedToken && token !== storedToken) {
      return jsonResponse({ error: "unauthorized" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss);

    // データをA1に保存、最終更新日時をB1に保存
    sheet.getRange("A1").setValue(JSON.stringify(body.data));
    sheet.getRange("B1").setValue(new Date().toLocaleString("ja-JP"));

    return jsonResponse({ ok: true });
  } catch(err) {
    return jsonResponse({ error: err.message });
  }
}

/* ─── ヘルパー ─── */
function getOrCreateSheet(ss) {
  return ss.getSheetByName("data") || ss.insertSheet("data");
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
