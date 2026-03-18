-- Step 1: Create the scholarships table
CREATE TABLE IF NOT EXISTS scholarships (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  criteria TEXT DEFAULT '',
  link TEXT DEFAULT '',
  deadline TEXT DEFAULT 'Varies',
  amount TEXT DEFAULT 'Varies',
  need_based TEXT DEFAULT ''
);

-- Step 2: Make scholarships publicly readable (no login required to browse)
ALTER TABLE scholarships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scholarships are publicly readable" 
  ON scholarships FOR SELECT 
  USING (true);
