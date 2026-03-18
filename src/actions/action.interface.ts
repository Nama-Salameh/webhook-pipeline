export interface Action {
  execute(payload: any): Promise<any>;
}