import { Action } from "./action.interface.js";

// Renames payload keys based on a provided map
// e.g. keyMap: { orderId: "order_id" } => { order_id: 1234 }
export class TransformKeysAction implements Action {
  async execute(payload: any): Promise<any> {
    const keyMap: Record<string, string> = payload._keyMap ?? {};
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (key === "_keyMap") continue;
      result[keyMap[key] ?? key] = value;
    }

    return result;
  }
}
