// --- Google Apps Script for Katsuta Marathon App ---

// 1. シート名を設定してください
const SHEET_NAME = 'data';

// 2. カラムの並び順（スプレッドシートの列順と合わせてください）
// ※実際のシートに合わせて修正が必要かもしれません
const HEADERS = [
    'id', 'name', 'category',
    '2019', '2020', '2023', '2024', '2025',
    'temp_2026', // I列: 2026年 (既存データ?)
    'average',   // J列
    'std_dev',   // K列: 標準偏差
    'prediction',// L列: 本誌予想
    'memo',      // M列: memo
    'status_2026', // N列
    'target_2026', // O列
    'result_2026', // P列
    'locked'       // Q列
];

function doGet(e) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // ヘッダー行を除去（もし1行目がヘッダーなら）

    // JSON形式に変換
    const users = data.map(row => {
        let user = { history: {} };
        HEADERS.forEach((key, index) => {
            // 過去記録は history オブジェクトにまとめる
            if (['2019', '2020', '2023', '2024', '2025'].includes(key)) {
                user.history[key] = row[index];
            } else {
                user[key] = row[index];
            }
        });
        return user;
    });

    return ContentService.createTextOutput(JSON.stringify(users))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    try {
        const params = JSON.parse(e.postData.contents);
        const id = params.id;
        const target = params.target_2026;
        const result = params.result_2026;
        const locked = params.locked;

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
        const data = sheet.getDataRange().getValues();

        // IDで検索して行を特定 (1行目はヘッダーと仮定して +2)
        // ※データの実装に合わせて調整してください
        let rowIndex = -1;
        for (let i = 1; i < data.length; i++) {
            // HEADERS[0] が 'id' だと仮定
            if (data[i][0] == id) {
                rowIndex = i + 1; // 1-based index for getRange
                break;
            }
        }

        if (rowIndex === -1) {
            return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'User not found' }));
        }

        // 更新処理
        // status_2026, target_2026, result_2026, locked の列番号を指定して更新
        // HEADERS配列のインデックス + 1 が列番号

        if (target !== undefined) {
            const targetCol = HEADERS.indexOf('target_2026') + 1;
            sheet.getRange(rowIndex, targetCol).setValue(target);
        }
        if (result !== undefined) {
            const resultCol = HEADERS.indexOf('result_2026') + 1;
            sheet.getRange(rowIndex, resultCol).setValue(result);
        }
        if (locked !== undefined) {
            const lockedCol = HEADERS.indexOf('locked') + 1;
            sheet.getRange(rowIndex, lockedCol).setValue(locked);
        }

        return ContentService.createTextOutput(JSON.stringify({ status: 'success', id: id }));

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }));
    }
}
