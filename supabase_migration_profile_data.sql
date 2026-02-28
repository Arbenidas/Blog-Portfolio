-- Migration: Add 'data' JSONB column to profiles table
-- This column stores structured profile data (experience, tech stacks, widgets, etc.)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}';
