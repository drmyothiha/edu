-- Add multilingual support for schools: name_en and name_my
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS name_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS name_my VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_schools_name_en ON schools(name_en);
CREATE INDEX IF NOT EXISTS idx_schools_name_my ON schools(name_my);

-- Split existing English and Burmese parts from name
UPDATE schools
SET 
    name_en = CASE 
        WHEN name ~ '[\u1000-\u109f]' AND name ~ '\(' THEN
            TRIM(regexp_replace(name, '^(.+?)\s*\(([\u1000-\u109f].*)\)$', '\1'))
        ELSE name
    END,
    name_my = CASE 
        WHEN name ~ '[\u1000-\u109f]' AND name ~ '\(' THEN
            TRIM(regexp_replace(name, '^(.+?)\s*\(([\u1000-\u109f].*)\)$', '\2'))
        ELSE name
    END;

-- Explicitly ensure Intaing BEHS values
UPDATE schools
SET 
    name_en = 'Basic Education High School Intaing',
    name_my = 'အခြေခံပညာအထက်တန်းကျောင်း အင်းတိုင်',
    name = 'အခြေခံပညာအထက်တန်းကျောင်း အင်းတိုင်'
WHERE code = 'MMR013035-BEHS01';

-- Update name column to store the Burmese name for all schools where Burmese name exists
UPDATE schools
SET name = name_my
WHERE name_my IS NOT NULL AND name_my != '';
