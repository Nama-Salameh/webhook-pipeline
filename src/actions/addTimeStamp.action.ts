import { Action } from "./action.interface.js";

export class AddTimestampAction implements Action {
  async execute(payload: any) {
    return {
      ...payload,
      processedAt: new Date().toISOString(),
    };
  }
}