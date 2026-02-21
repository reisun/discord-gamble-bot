import { CoreMessage } from "./core";
import { GambleMessage } from "./gamble";
import { SplaJinroMessage } from "./splajinro";

export type AppMessage = CoreMessage | SplaJinroMessage | GambleMessage;
