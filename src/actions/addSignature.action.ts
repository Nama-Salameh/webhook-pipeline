import { Action } from "./action.interface.js";
import { createHmac } from "crypto";

const SECRET = process.env.WEBHOOK_SECRET ?? "default-secret";

export class AddSignatureAction implements Action {
  constructor(private secret: string = SECRET) {}

  async execute(payload: any) {
    const payloadToSign = { ...payload, timestamp: new Date().toISOString() };
    const signature = createHmac("sha256", this.secret)
      .update(JSON.stringify(payloadToSign))
      .digest("hex");
    return { ...payloadToSign, signature };
  }
}
