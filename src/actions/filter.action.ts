import { Action } from "./action.interface.js";
export class FilterAction implements Action {
  async execute(payload: any): Promise<any | null> {
    const { field, value } = payload._filter ?? {};

    if (field && payload[field] !== value) {
      return null;
    }

    const { _filter, ...rest } = payload;
    return rest;
  }
}