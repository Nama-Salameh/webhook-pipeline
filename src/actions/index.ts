import { AddTimestampAction } from "./addTimestamp.action.js";

export const getAction = (type: string) => {
  switch (type) {
    case "addTimestamp":
      return new AddTimestampAction();

    default:
      throw new Error(`Unknown action type: ${type}`);
  }
};