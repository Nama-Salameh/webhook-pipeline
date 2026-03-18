import { AddTimestampAction } from "./addTimeStamp.action.js";
import { TransformKeysAction } from "./transformKeys.action.js";
import { FilterAction } from "./filter.action.js";

export const getAction = (type: string) => {
  switch (type) {
    case "addTimestamp":  return new AddTimestampAction();
    case "transformKeys": return new TransformKeysAction();
    case "filter":        return new FilterAction();
    default:              throw new Error(`Unknown action type: ${type}`);
  }
};
