CREATE TABLE grammar_settings(id INTEGER PRIMARY KEY CHECK(id=1),daily_count INTEGER NOT NULL DEFAULT 10,topics TEXT NOT NULL DEFAULT '[]',seed_version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE grammar_questions(id TEXT PRIMARY KEY,data TEXT NOT NULL,topic TEXT NOT NULL,position INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
CREATE TABLE grammar_progress(student TEXT NOT NULL,question TEXT NOT NULL REFERENCES grammar_questions(id),next_due TEXT,streak INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,wrong INTEGER NOT NULL DEFAULT 0,last_day TEXT NOT NULL,PRIMARY KEY(student,question));
CREATE INDEX idx_grammar_due ON grammar_progress(student,next_due);
CREATE TABLE grammar_attempts(id TEXT PRIMARY KEY,student TEXT NOT NULL,question TEXT NOT NULL REFERENCES grammar_questions(id),day TEXT NOT NULL,kind TEXT NOT NULL,position INTEGER NOT NULL,snapshot TEXT NOT NULL,choice INTEGER,correct INTEGER,unsure INTEGER NOT NULL DEFAULT 0,result TEXT,answered TEXT,UNIQUE(student,question,day));
CREATE INDEX idx_grammar_day ON grammar_attempts(student,day);
