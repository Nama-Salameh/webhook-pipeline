export type Pipeline = {
  id: number;
  name: string;
  action_type: string;
  action_options: Record<string, any>;
  enabled: boolean;
  created_at: Date;
};

export type CreatePipelineDTO = {
  name: string;
  action_type: string;
  action_options?: Record<string, any>;
};