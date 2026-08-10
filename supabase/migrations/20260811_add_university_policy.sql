-- Add university_policy column to projects table if it doesn't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS university_policy TEXT;
