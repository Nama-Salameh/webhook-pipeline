export type Subscriber = {
  id: number;
  pipeline_id: number;
  target_url: string;
  created_at: Date;
};

export type CreateSubscriberDTO = {
  targetUrl: string;
};