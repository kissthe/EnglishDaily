CREATE TABLE vocabulary_settings(id INTEGER PRIMARY KEY CHECK(id=1),daily_new INTEGER NOT NULL DEFAULT 8,seed_version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE vocabulary_words(id TEXT PRIMARY KEY,data TEXT NOT NULL,position INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);
CREATE TABLE vocabulary_progress(student TEXT NOT NULL,word TEXT NOT NULL REFERENCES vocabulary_words(id),next_due TEXT NOT NULL,streak INTEGER NOT NULL DEFAULT 0,reviews INTEGER NOT NULL DEFAULT 0,lapses INTEGER NOT NULL DEFAULT 0,last_day TEXT NOT NULL,PRIMARY KEY(student,word));
CREATE INDEX idx_vocabulary_due ON vocabulary_progress(student,next_due);
CREATE TABLE vocabulary_attempts(id TEXT PRIMARY KEY,student TEXT NOT NULL,word TEXT NOT NULL REFERENCES vocabulary_words(id),day TEXT NOT NULL,is_new INTEGER NOT NULL,snapshot TEXT NOT NULL,result TEXT,created TEXT NOT NULL,UNIQUE(student,word,day));
CREATE INDEX idx_vocabulary_day ON vocabulary_attempts(student,day);
