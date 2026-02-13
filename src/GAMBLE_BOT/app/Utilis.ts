
/**
 * 汎用ユーティリティ
 */
export class Utils {
    static unique = <T>(list: T[], getKey: (v: T) => any): T[] => {
        return list.filter((element, index, selfArray) => {
            return index === selfArray.findIndex((obj) => getKey(obj) === getKey(element));
        });
    }
    static getRandomInt = (max: number): number => {
        return Math.floor(Math.random() * (max + 1));
    }
    /**
     * 
     * @param from ループ開始の数
     * @param to ループ条件 (i < to) 相当。(ex: to=100 なら 99 で終わり)
     * @returns 
     */
    static range = (from: number, to: number) => ([...Array(to - from)].map((_, i) => (from + i)));

    static format = (str: string, ...args: unknown[]) => {
        let msg = str.concat(); // コピー
        args.forEach((val, idx) => {
            let regx = new RegExp(`\\{${idx}\\}`, "g");
            msg = msg.replace(regx, val?.toString() ?? "");
        });
        return msg;
    }
}