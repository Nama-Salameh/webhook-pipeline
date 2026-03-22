import { Action } from "./action.interface.js";

const SENSITIVE_FIELDS = ["password", "token", "secret", "email", "phone", "ssn"];

export class MaskSensitiveAction implements Action {
  constructor(private sensitiveFields: string[] = SENSITIVE_FIELDS, private mask: string = "***") {}

  async execute(payload: any) {
    const masked = { ...payload };
    for (const key of Object.keys(masked)) {
      if (this.sensitiveFields.includes(key.toLowerCase())) {
        masked[key] = this.mask;
      }
    }
    return masked;
  }
}