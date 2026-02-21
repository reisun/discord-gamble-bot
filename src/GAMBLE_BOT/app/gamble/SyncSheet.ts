import { GambleSession, GambleSyncMode } from '../models/gamble';

type SyncResult = {
    mode: GambleSyncMode,
    rows: {
        users_balance: number,
        bets: number,
        ledger: number,
    }
}

class SyncError extends Error {
    constructor(
        public code: "auth" | "sheet_id" | "permission" | "runtime",
        message: string,
    ) {
        super(message);
    }
}

export class SyncSheetService {
    private static readonly USERS_SHEET = "users_balance";
    private static readonly BETS_SHEET = "bets";
    private static readonly LEDGER_SHEET = "ledger";

    static async sync(session: GambleSession, mode: GambleSyncMode): Promise<SyncResult> {
        if (mode == "incremental") {
            // 増分は将来対応。現時点ではフル再生成で同期する
            mode = "full";
        }
        if (mode != "full") {
            throw new SyncError("runtime", "未対応の同期モードです。full または incremental を指定してください。");
        }

        const token = this.resolveCredential(session.credentialRef);
        const spreadsheetId = session.spreadsheetId.trim();
        if (!spreadsheetId) {
            throw new SyncError("sheet_id", "spreadsheetId が未設定です。/gb_sync spreadsheet_id:<ID> で設定してください。");
        }

        await this.ensureSheets(spreadsheetId, token, [
            this.USERS_SHEET,
            this.BETS_SHEET,
            this.LEDGER_SHEET,
        ]);

        await this.overwriteSheet(
            spreadsheetId,
            token,
            this.USERS_SHEET,
            [["userId", "name", "initialPoint", "currentPoint"], ...session.users_balance.map(v => [v.userId, v.name, String(v.initialPoint), String(v.currentPoint)])],
        );
        await this.overwriteSheet(
            spreadsheetId,
            token,
            this.BETS_SHEET,
            [["gameId", "userId", "ticket", "point", "createdAt"], ...session.bets.map(v => [v.gameId, v.userId, v.ticket, String(v.point), v.createdAt.toISOString()])],
        );
        await this.overwriteSheet(
            spreadsheetId,
            token,
            this.LEDGER_SHEET,
            [["userId", "delta", "reason", "gameId", "balanceAfter", "createdAt"], ...session.ledger.map(v => [v.userId, String(v.delta), v.reason, v.gameId, String(v.balanceAfter), v.createdAt.toISOString()])],
        );

        return {
            mode,
            rows: {
                users_balance: session.users_balance.length,
                bets: session.bets.length,
                ledger: session.ledger.length,
            },
        };
    }

    static toDiscordErrorMessage(error: unknown): string {
        if (error instanceof SyncError) {
            switch (error.code) {
                case "auth":
                    return `同期に失敗しました（認証エラー）。credentialRef を確認してください。\n詳細: ${error.message}`;
                case "sheet_id":
                    return `同期に失敗しました（シートIDエラー）。spreadsheetId を確認してください。\n詳細: ${error.message}`;
                case "permission":
                    return `同期に失敗しました（権限エラー）。対象スプレッドシートへの編集権限を確認してください。\n詳細: ${error.message}`;
                default:
                    return `同期に失敗しました。\n詳細: ${error.message}`;
            }
        }
        return `同期に失敗しました。\n詳細: ${String(error)}`;
    }

    private static resolveCredential(credentialRef: string): string {
        const envKey = credentialRef.trim();
        if (!envKey) {
            throw new SyncError("auth", "credentialRef が未設定です。アクセストークンを格納した環境変数名を設定してください。");
        }
        const token = process.env[envKey]?.trim() ?? "";
        if (!token) {
            throw new SyncError("auth", `credentialRef(${envKey}) に対応する環境変数が空です。`);
        }
        return token;
    }

    private static async ensureSheets(spreadsheetId: string, token: string, sheetNames: string[]): Promise<void> {
        const metadata = await this.fetchJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, token, "GET");
        const existing = new Set<string>(
            Array.isArray(metadata.sheets)
                ? metadata.sheets
                    .map((s: any) => s.properties?.title)
                    .filter((name: unknown) => typeof name == "string")
                : []
        );

        const requests = sheetNames
            .filter(name => !existing.has(name))
            .map(name => ({ addSheet: { properties: { title: name } } }));

        if (requests.length == 0) {
            return;
        }

        await this.fetchJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, token, "POST", {
            requests,
        });
    }

    private static async overwriteSheet(spreadsheetId: string, token: string, sheetName: string, values: string[][]): Promise<void> {
        await this.fetchJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A:Z")}:clear`, token, "POST", {});
        await this.fetchJson(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1")}?valueInputOption=RAW`,
            token,
            "PUT",
            { values },
        );
    }

    private static async fetchJson(url: string, token: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<any> {
        const response = await fetch(url, {
            method,
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: body == undefined ? undefined : JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text();
            if (response.status == 401) {
                throw new SyncError("auth", `Google Sheets API 認証エラー(401): ${text}`);
            }
            if (response.status == 403) {
                throw new SyncError("permission", `Google Sheets API 権限エラー(403): ${text}`);
            }
            if (response.status == 404) {
                throw new SyncError("sheet_id", `Google Sheets API 参照エラー(404): ${text}`);
            }
            throw new SyncError("runtime", `Google Sheets API エラー(${response.status}): ${text}`);
        }

        if (response.status == 204) {
            return {};
        }
        return await response.json();
    }
}
