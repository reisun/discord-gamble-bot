import { AppMessage } from "./constants/messages";

export type ResultOK = "OK";
export const ResultOK = "OK";

export type Result<T> = { status: ResultOK, value: T } | { status: AppMessage, value: null }

export class ResultUtil {
    static success<T>(v: T): Result<T> { return { status: ResultOK, value: v } }
    static error<T>(errorMsg: AppMessage): Result<T> { return { status: errorMsg, value: null } }
}
