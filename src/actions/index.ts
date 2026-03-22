import { AddTimestampAction } from "./addTimeStamp.action.js";
import { TransformKeysAction } from "./transformKeys.action.js";
import { FilterAction } from "./filter.action.js";
import { MaskSensitiveAction } from "./maskSensitive.action.js";
import { AddSignatureAction } from "./addSignature.action.js";

import { ValidationError } from "../middleware/error.js";

export const getAction = (type: string, options?: any) => {
  switch (type) {
    case "addTimestamp":    return new AddTimestampAction();
    case "transformKeys":   return new TransformKeysAction();
    case "filter":          return new FilterAction();
    case "maskSensitive":   return new MaskSensitiveAction(options?.fields, options?.mask);
    case "addSignature":    return new AddSignatureAction(options?.secret);
    default:                throw new ValidationError(`Unknown action type: ${type}`);
  }
};
