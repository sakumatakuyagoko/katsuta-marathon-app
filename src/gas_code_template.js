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

const CONFIG_SHEET_NAME = 'config';

function doGet(e) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);

    // データ取得
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // ヘッダー除去

    // Config取得
    let config = {};
    if (configSheet) {
        const configData = configSheet.getDataRange().getValues();
        configData.forEach(row => {
            if (row[0]) config[row[0]] = row[1];
        });
    }

    // JSON形式に変換
    const users = data.map(row => {
        let user = { history: {} };
        HEADERS.forEach((key, index) => {
            if (['2019', '2020', '2023', '2024', '2025'].includes(key)) {
                user.history[key] = row[index];
            } else {
                user[key] = row[index];
            }
        });
        return user;
    });

    return ContentService.createTextOutput(JSON.stringify({ users: users, config: config }))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    try {
        const params = JSON.parse(e.postData.contents);
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        // Config更新の場合
        if (params.type === 'config') {
            const configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
            if (!configSheet) return errorResponse('Config sheet not found');

            // シンプルに全クリアして書き直す（行数が少ないので）
            configSheet.clear();
            const configData = [];
            if (params.dice_minus !== undefined) configData.push(['dice_minus', params.dice_minus]);
            if (params.dice_plus !== undefined) configData.push(['dice_plus', params.dice_plus]);

            if (configData.length > 0) {
                configSheet.getRange(1, 1, configData.length, 2).setValues(configData);
            }
            return successResponse({ updated: 'config' });
        }

        // ユーザーデータ更新 (既存処理)
        const id = params.id;
        const target = params.target_2026;
        const result = params.result_2026;
        const locked = params.locked;

        const sheet = ss.getSheetByName(SHEET_NAME);
        const data = sheet.getDataRange().getValues();

        let rowIndex = -1;
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] == id) {
                rowIndex = i + 1;
                break;
            }
        }

        if (rowIndex === -1) return errorResponse('User not found');

        if (target !== undefined) {
            sheet.getRange(rowIndex, HEADERS.indexOf('target_2026') + 1).setValue(target);
        }
        if (result !== undefined) {
            sheet.getRange(rowIndex, HEADERS.indexOf('result_2026') + 1).setValue(result);
        }
        if (locked !== undefined) {
            sheet.getRange(rowIndex, HEADERS.indexOf('locked') + 1).setValue(locked);
        }

        return successResponse({ id: id });

    } catch (error) {
        return errorResponse(error.toString());
    }
}

function successResponse(data) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...data }))
        .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: message }))
        .setMimeType(ContentService.MimeType.JSON);
}
