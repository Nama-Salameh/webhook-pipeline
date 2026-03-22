type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export const checkRateLimit = (key: string, max: number, windowMs: number): boolean => {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
  }

  bucket.count++;
  buckets.set(key, bucket);

  return bucket.count <= max;
};
