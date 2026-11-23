CREATE TABLE close_reading(student TEXT NOT NULL,task TEXT NOT NULL REFERENCES tasks(id),data TEXT NOT NULL DEFAULT '{}',updated TEXT NOT NULL,PRIMARY KEY(student,task));
CREATE TABLE study_cards(id TEXT PRIMARY KEY,student TEXT NOT NULL,task TEXT NOT NULL REFERENCES tasks(id),data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,UNIQUE(student,task));
CREATE INDEX idx_study_cards_student ON study_cards(student,updated);
