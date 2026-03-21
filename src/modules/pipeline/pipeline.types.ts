export type Pipeline = {
  id: number;
  name: string;
  action_type: string;
  created_at: Date;
};

export type CreatePipelineDTO = {
  name: string;
  action_type: string;
};