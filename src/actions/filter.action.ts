import { Action } from "./action.interface.js";
export class FilterAction implements Action {
  async execute(payload: any): Promise<{ skipped?: boolean; payload?: any; reason?: string }> {
    const { field, value } = payload._filter ?? {};

    if (field && payload[field] !== value) {
      return { skipped: true, reason: `${field} !== ${value}` };
    }

    const { _filter, ...rest } = payload;
    return { payload: rest };
  }
}