import { eMessage } from "./Const";

export type ResultOK = "OK";
export const ResultOK = "OK";

export type Result<T> = { status: ResultOK, value: T } | { status: eMessage, value: null }

export class ResultUtil {
    static success<T>(v: T): Result<T> { return { status: ResultOK, value: v } }
    static error<T>(errorMsg: eMessage): Result<T> { return { status: errorMsg, value: null } }
}