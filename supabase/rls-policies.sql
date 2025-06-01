-- Enable Row Level Security
ALTER TABLE user_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- User Models policies
-- Only allow users to view their own user models
CREATE POLICY "Users can view their own user models" 
  ON user_models FOR SELECT 
  USING (auth.uid()::text = user_id);

-- Only allow users to update their own user models
CREATE POLICY "Users can update their own user models" 
  ON user_models FOR UPDATE 
  USING (auth.uid()::text = user_id);

-- Only allow users to insert their own user models
CREATE POLICY "Users can insert their own user models" 
  ON user_models FOR INSERT 
  WITH CHECK (auth.uid()::text = user_id);

-- Generations policies
-- Only allow users to view their own generations
CREATE POLICY "Users can view their own generations" 
  ON generations FOR SELECT 
  USING (auth.uid()::text = user_id);

-- Only allow users to update their own generations
CREATE POLICY "Users can update their own generations" 
  ON generations FOR UPDATE 
  USING (auth.uid()::text = user_id);

-- Only allow users to insert their own generations
CREATE POLICY "Users can insert their own generations" 
  ON generations FOR INSERT 
  WITH CHECK (auth.uid()::text = user_id);

-- Create a separate policy for the webhook service
-- This allows the service role to update records regardless of user_id
-- Note: This isn't needed when using the service role key directly,
-- as it bypasses RLS completely, but it's good to have for documentation
CREATE POLICY "Service can update any user model" 
  ON user_models FOR UPDATE 
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service can update any generation" 
  ON generations FOR UPDATE 
  USING (auth.jwt() ->> 'role' = 'service_role');
